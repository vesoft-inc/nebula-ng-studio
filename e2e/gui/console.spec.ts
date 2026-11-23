import { expect } from '@playwright/test';
import { test, guiRows } from '../support/gui';
import { signIn, readResult, runQuery, runButton, gate } from '../support/browser';
test('signs in through the dialog, recovers from 401 and uses the new identity', async ({ page, api }) => {
  api.authorized = false;
  await page.goto('/');
  await expect(page).toHaveURL(/\/ui\/console$/);
  await signIn(page, 'alice', 'wrong');
  await expect(page.getByText('Login failed, please check your username and password')).toBeVisible();
  await signIn(page, 'alice', 'correct');
  await expect(page.getByRole('dialog')).toBeHidden();
  api.authorized = false;
  await runQuery(page, 'RETURN expired');
  await signIn(page, 'bob', 'correct');
  api.query = async (gql, req) => {
    if (!gql.includes('RETURN')) return;
    expect(req.headers().authorization).toBe('Bearer fixture-token');
    return guiRows([{ answer: 'bob-result' }]);
  };
  await runQuery(page, 'RETURN 7');
  await readResult(page, 'bob-result');
});
test('waits for a session ID and cancels only the old query', async ({ page, api }) => {
  const session = gate();
  const response = gate();
  const sent = gate();
  api.query = async (gql, req) => {
    if (gql === 'SHOW CURRENT_SESSION') {
      await session.pending;
      return guiRows([{ id: 'session-17' }]);
    }
    if (gql.includes('long')) {
      expect(req.postDataJSON()).toEqual({ gql });
      expect(req.headers()['x-request-timeout']).toBe('120000');
      sent.release();
      await response.pending;
      return guiRows([{ answer: 'obsolete-result' }]);
    }
    if (gql.includes('next')) return guiRows([{ answer: 'next-result' }]);
    return undefined;
  };
  await page.goto('/ui/console');
  await runQuery(page, 'RETURN long');
  await expect(runButton(page)).toBeDisabled();
  session.release();
  await sent.pending;
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect.poll(() => api.cancelIds).toEqual(['session-17']);
  await runQuery(page, 'RETURN next');
  await readResult(page, 'next-result');
  response.release();
  await expect(page.getByText('obsolete-result')).toHaveCount(0);
});

test('a missing session ID leaves the running query locked and allows the next run', async ({ page, api }) => {
  const response = gate(),
    started = gate();
  api.query = async (gql) => {
    if (gql === 'SHOW CURRENT_SESSION') return guiRows([]);
    if (gql.includes('slow')) {
      started.release();
      await response.pending;
      return guiRows([{ answer: 'finished' }]);
    }
    if (gql.includes('next')) return guiRows([{ answer: 'follow-up' }]);
    return undefined;
  };
  await page.goto('/ui/console');
  await runQuery(page, 'RETURN slow');
  await started.pending;
  await expect(runButton(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0);
  response.release();
  await readResult(page, 'finished');
  await runQuery(page, 'RETURN next');
  await readResult(page, 'follow-up');
  expect(api.cancelIds).toEqual([]);
});
test('persists query settings across reload and omits the timeout header at zero', async ({ page, api }) => {
  api.authorized = false;
  await page.goto('/ui/console');
  await signIn(page, 'alice', 'correct');
  const headers: (string | undefined)[] = [];
  api.query = async (gql, req) => {
    if (gql.includes('RETURN')) {
      headers.push(req.headers()['x-request-timeout']);
      return guiRows([{ answer: 'saved-' + headers.length }]);
    }
    return undefined;
  };
  for (const seconds of [37, 0]) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const timeout = page.getByRole('spinbutton').first();
    await timeout.fill(String(seconds));
    await timeout.blur();
    await page.reload();
    await runQuery(page, 'RETURN 37');
    await readResult(page, 'saved-' + (seconds === 37 ? 1 : 2));
  }
  expect(headers).toEqual(['37000', undefined]);
});
