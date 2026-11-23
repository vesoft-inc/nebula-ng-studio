import { expect } from '@playwright/test';
import { test } from '../support/web';
import { signIn, readResult, disconnect, runQuery, runButton, gate, enterQuery } from '../support/browser';
import { failure, table } from '../support/http';

test('login retries return to the protected deep link and logout protects browser history', async ({ page, api }) => {
  api.user = null;
  let attempts = 0;
  api.override = async (path) =>
    path === '/db/connect' && ++attempts === 1 ? failure('Invalid fixture password') : undefined;
  const target = '/studio/console?view=table#history';
  await page.goto(target);
  await signIn(page, 'alice', 'incorrect');
  await readResult(page, 'Invalid fixture password');
  await signIn(page, 'alice', 'correct');
  await expect(page).toHaveURL(target);
  await page.getByRole('tab', { name: 'Schema', exact: true }).click();
  await expect(page).toHaveURL(/schema-manager/);
  await disconnect(page, 'alice');
  await expect(page).toHaveURL(/\/login/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('input[name=password]')).toBeVisible();
  await expect(runButton(page)).toHaveCount(0);
});
test('a pending Console query runs once and results and draft survive a route round trip', async ({ page, api }) => {
  const response = gate();
  api.query = async (gql, req) => {
    expect(gql).toMatch(/RETURN 42/);
    expect(req.postDataJSON().timeout).toBe(120000);
    await response.pending;
    return table([{ answer: 'persistent-result' }]);
  };
  await page.goto('/studio/console');
  await runQuery(page, 'RETURN 42');
  await expect(runButton(page)).toBeDisabled();
  await page.getByRole('textbox', { name: 'Editor content' }).press('Shift+Enter');
  response.release();
  await readResult(page, 'persistent-result');
  await enterQuery(page, 'RETURN 43');
  await page.getByRole('tab', { name: 'Schema', exact: true }).click();
  await expect(page).toHaveURL(/schema-manager/);
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await readResult(page, 'persistent-result');
  await expect(page.locator('.monaco-editor:not(.readonly)').first()).toContainText('RETURN 43');
  expect(api.consoleRequests).toHaveLength(1);
});
test('an error stops subsequent statements and a new query recovers', async ({ page, api }) => {
  api.query = async (gql) =>
    gql.includes('broken') ? failure('Rejected statement') : table([{ answer: 'recovered-result' }]);
  await page.goto('/studio/console');
  await runQuery(page, '"""RETURN broken""" RETURN skipped');
  await readResult(page, 'Rejected statement');
  await runQuery(page, 'RETURN 42');
  await readResult(page, 'recovered-result');
  expect(api.consoleRequests).toEqual([expect.stringMatching(/RETURN broken$/), expect.stringMatching(/RETURN 42$/)]);
});

test('late work from Alice stays out of Bob’s Console after session expiry', async ({ page, api }) => {
  const response = gate(),
    started = gate(),
    released = gate();
  api.query = async (gql) => {
    if (gql.includes('slow')) {
      started.release();
      await response.pending;
      released.release();
      return table([{ answer: 'alice-private' }]);
    }
    return table([{ answer: 'bob-only' }]);
  };
  await page.goto('/studio/console');
  await runQuery(page, 'RETURN slow');
  await started.pending;
  api.override = async (path) =>
    path === '/explorer/snapshots' ? failure('Session expired', 40104001, 401) : undefined;
  await page.getByRole('tab', { name: 'Explorer', exact: true }).click();
  await expect(page.locator('input[name=password]')).toBeVisible();
  api.override = undefined;
  api.loginAs = 'bob';
  await signIn(page, 'bob', 'correct');
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await runQuery(page, 'RETURN 2');
  await readResult(page, 'bob-only');
  response.release();
  await released.pending;
  await expect(page.getByRole('button', { name: 'bob', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: /alice-private/ })).toHaveCount(0);
});
test('schema switching preserves results after a rejection and clears them on success', async ({ page, api }) => {
  api.query = async () => table([{ answer: 'initial-result' }]);
  await page.goto('/studio/console');
  await runQuery(page, 'RETURN 1');
  await readResult(page, 'initial-result');
  await page.getByRole('tab', { name: 'Schema', exact: true }).click();
  let attempts = 0;
  api.override = async (path) =>
    path === '/nebula/changeSchema' && ++attempts === 1 ? failure('Schema switch rejected') : undefined;
  async function selectOther() {
    await page.getByRole('button', { name: 'initial', exact: true }).click();
    await page.getByText('/other', { exact: true }).click();
  }
  await selectOther();
  await readResult(page, 'Schema switch rejected');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await readResult(page, 'initial-result');
  await page.getByRole('tab', { name: 'Schema', exact: true }).click();
  await selectOther();
  await expect(page.getByRole('button', { name: 'other', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await expect(runButton(page)).toBeEnabled();
  await expect(page.getByRole('cell', { name: /initial-result/ })).toHaveCount(0);
});
