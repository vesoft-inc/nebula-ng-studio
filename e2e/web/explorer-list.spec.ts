import { expect } from '@playwright/test';
import { test } from '../support/web';
import { snapshots, seedGraph } from '../support/explorer';
import { gate } from '../support/browser';
import { failure } from '../support/http';

test('snapshot pagination and filters reset across schemas and ignore the previous search response', async ({
  page,
  api,
}) => {
  for (let index = 1; index <= 10; index++) seedGraph(api, 'initial-' + index);
  seedGraph(api, 'other-only', { schemaPath: '/other' });
  api.graphs.push('another-graph');
  api.snapshots.get('initial-2')!.graph = 'another-graph';
  await page.goto(snapshots);
  const button = (id: string) => page.getByRole('button', { name: 'Canvas ' + id, exact: true });
  await expect(button('initial-1')).toBeVisible({ timeout: 12000 });
  await expect(button('initial-10')).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to page 2', exact: true }).click();
  await expect(button('initial-10')).toBeVisible();
  await expect(button('initial-1')).toHaveCount(0);
  const name = page.getByRole('textbox', { name: 'Exploration Name' });
  const graph = page.getByRole('combobox', { name: 'Graph', exact: true });
  await graph.click();
  await page.getByRole('option', { name: 'people-demo', exact: true }).click();
  await expect(button('initial-1')).toBeVisible();
  await expect(button('initial-2')).toHaveCount(0);
  await name.fill('initial-3');
  await expect(button('initial-3')).toBeVisible();
  await expect(button('initial-10')).toHaveCount(0);

  const slow = gate();
  api.override = async (path, request) => {
    const query = new URL(request.url()).searchParams;
    if (path === '/explorer/snapshots' && JSON.parse(query.get('filter') ?? '{}').name === 'previous-schema') {
      await slow.pending;
    }
    return undefined;
  };
  const search = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get('filter')?.includes('previous-schema') ?? false
  );
  await name.fill('previous-schema');
  const oldRequest = await search;
  const oldResponse = page.waitForResponse((response) => response.request() === oldRequest);
  try {
    await page.getByRole('combobox', { name: 'Schema', exact: false }).click();
    await page.getByRole('option', { name: /other/ }).click();
    await expect(name).toHaveValue('');
    await expect(graph).toHaveValue('');
    await expect(button('other-only')).toBeVisible();
  } finally {
    slow.release();
  }
  await (await oldResponse).finished();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  );
  await expect(button('initial-3')).toHaveCount(0);
  await expect(button('other-only')).toBeVisible();
});

test('explorer settings report a refused write and restore the saved query and hover options', async ({
  page,
  api,
}) => {
  const appKey = 'explorer-app-config-v1';
  const personalKey = appKey + '-alice';
  api.config.set(appKey, JSON.stringify({ queryTimeout: 120, maxRowsLimit: 100, maxNeighborsLimit: 100 }));
  api.config.set(personalKey, JSON.stringify({ displayPropertiesOnHover: true, highlightNeighborsOnHover: true }));
  let refuse = true;
  api.override = async (path, request) => {
    if (path === '/explorer/global-config/upsert' && request.postDataJSON().key === appKey && refuse) {
      return failure('Settings write refused');
    }
    return undefined;
  };
  await page.goto(snapshots);
  const open = page.getByRole('button', { name: 'Explorer settings', exact: true });
  const duration = page.locator('input[name="queryTimeout"]');
  const hover = page.locator('input[name="displayPropertiesOnHover"]');
  const close = page.getByRole('button', { name: 'Close settings', exact: true });
  await expect(open).toBeVisible({ timeout: 12000 });
  await open.click();
  await duration.fill('180');
  await duration.press('Tab');
  await close.click();
  await expect(page.getByText('Failed to save config', { exact: true })).toBeVisible();
  expect(JSON.parse(api.config.get(appKey)!).queryTimeout).toBe(120);

  refuse = false;
  await open.click();
  await duration.fill('197');
  await duration.press('Tab');
  await hover.uncheck();
  await close.click();
  await expect.poll(() => JSON.parse(api.config.get(appKey)!).queryTimeout).toBe(197);
  await expect.poll(() => JSON.parse(api.config.get(personalKey)!).displayPropertiesOnHover).toBe(false);
  await page.reload();
  await open.click();
  await expect(duration).toHaveValue('197');
  await expect(hover).not.toBeChecked();
});
