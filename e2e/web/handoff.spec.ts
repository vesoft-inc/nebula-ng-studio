import { expect, type Page } from '@playwright/test';
import { test, type StudioApi } from '../support/web';
import { runQuery, gate, signIn } from '../support/browser';
import { failure, table } from '../support/http';

const graphRows = () =>
  table([
    {
      n: {
        type: 'NODE',
        raw: '7',
        value: { id: 7, graph: 'people-demo', type: 'Person', labels: ['Person'], properties: { name: 'Ada' } },
      },
    },
  ]);
async function openGraphResult(page: Page, api: StudioApi) {
  api.query = async () => graphRows();
  await page.goto('/studio/console');
  await runQuery(page, 'MATCH (n) RETURN n');
  await page.getByRole('tab', { name: 'Graph', exact: true }).click();
  return page.getByRole('button', { name: 'Explore in Explorer' });
}

test('a graph result can retry, reopen and replace a missing snapshot', async ({ page, api }) => {
  let creates = 0;
  api.override = async (path, req) => {
    if (path !== '/explorer/snapshots' || req.method() !== 'POST') return;
    expect(req.postDataJSON().schema_path).toBe('/initial');
    if (++creates === 1) return failure('Create snapshot refused');
    return undefined;
  };
  const explore = await openGraphResult(page, api);
  await explore.click();
  await expect(page.getByText('Create snapshot refused')).toBeVisible();
  await explore.click();
  await expect(page).toHaveURL('/studio/explorer/snapshots/1');
  const reopen = async () => {
    await page.getByRole('tab', { name: 'Console', exact: true }).click();
    await page.getByRole('tab', { name: 'Graph', exact: true }).click();
    await explore.click();
  };
  await reopen();
  await expect(page).toHaveURL('/studio/explorer/snapshots/1');
  expect(creates).toBe(2);
  api.snapshots.delete('1'); // Removed by another client.
  await reopen();
  await expect(page).toHaveURL('/studio/explorer/snapshots/2');
  expect(creates).toBe(3);
});

test('session expiry suppresses a late snapshot navigation', async ({ page, api }) => {
  const started = gate(),
    response = gate();
  api.override = async (path, req) => {
    if (path !== '/explorer/snapshots' || req.method() !== 'POST') return;
    started.release();
    await response.pending;
    return undefined;
  };
  const explore = await openGraphResult(page, api);
  await explore.click();
  await started.pending;
  await page.getByRole('tab', { name: 'Schema', exact: true }).click();
  api.override = async (path) => (path === '/explorer/snapshots' ? failure('Expired', 40104001, 401) : undefined);
  await page.getByRole('tab', { name: 'Explorer', exact: true }).click();
  await expect(page.locator('input[name=password]')).toBeVisible();
  api.override = undefined;
  api.loginAs = 'bob';
  await signIn(page, 'bob', 'correct');
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  response.release();
  await expect.poll(() => api.snapshots.size).toBe(1);
  await expect(page).toHaveURL('/studio/console');
  await expect(explore).toHaveCount(0);
});
