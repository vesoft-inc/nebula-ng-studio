import { expect } from '@playwright/test';
import { test } from '../support/web';
import { failure } from '../support/http';

test('graph creation recovers from rejected writes and survives a failed list refresh', async ({ page, api }) => {
  const name = 'saved-graph';
  let writes = 0;
  let failRefresh = false;
  api.override = async (path, request) => {
    if (path !== '/gql/exec') return;
    const { gql } = request.postDataJSON();
    if (gql.startsWith('CREATE GRAPH ')) {
      if (++writes === 1) return failure('Graph creation refused');
      failRefresh = true;
    } else if (failRefresh && gql.startsWith('call show_graphs()')) {
      failRefresh = false;
      return failure('List refresh failed');
    }
    return undefined;
  };
  await page.goto('/studio/schema-manager/graphs');
  await page.getByRole('button', { name: 'Create Graph', exact: true }).last().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'People' }).click();
  await dialog.locator('input[name=graphName]').fill(name);
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Graph creation refused')).toBeVisible();
  await expect(dialog.locator('input[name=graphName]')).toHaveValue(name);
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('List refresh failed')).toBeVisible();
  await page.reload();
  await expect(page.getByText(name, { exact: true }).last()).toBeVisible();
  expect(writes).toBe(2);
});
test('graph detail restores its source and browser history under a deployment prefix', async ({ page, api }) => {
  api.graphs = ['研究-Graph'];
  await page.goto('/studio/console');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
  const list = '/studio/schema-manager/graphs?filter=mine#list';
  await page.goto(list);
  await page.getByText('研究-Graph', { exact: true }).last().click();
  await expect(page).toHaveURL(/graphs\/.+/);
  await page.locator('svg:has(+ .MuiBreadcrumbs-root)').click();
  await expect(page).toHaveURL(list);
  await page.goBack();
  await expect(page).toHaveURL(/\/console$/);
});

test('a fresh tab opened directly on a graph detail stays there when Back is pressed', async ({
  page,
  api,
  baseURL,
}) => {
  const detail = '/studio/schema-manager/graphs/' + api.graphs[0];
  // Navigate the new tab in place so about:blank is not a previous history entry.
  await page.evaluate((url) => location.replace(url), new URL(detail, baseURL).href);
  await expect(page).toHaveURL(detail);
  expect(await page.evaluate(() => history.length)).toBe(1);
  await page.locator('svg:has(+ .MuiBreadcrumbs-root)').click();
  await expect(page).toHaveURL(detail);
  await expect(page.getByRole('button', { name: 'Create Index' })).toBeVisible();
});
