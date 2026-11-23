import { expect } from '@playwright/test';
import { test } from '../support/web';
import { failure, ok, table } from '../support/http';
import { gate } from '../support/browser';
import type { Page } from '@playwright/test';

async function addNode(page: Page, name: string) {
  await page.getByRole('button', { name: 'Node Type', exact: true }).click();
  await page.getByRole('button', { name: 'Create Node Type' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name=name]').fill(name);
  await dialog.getByRole('button', { name: 'Add Property' }).click();
  await dialog.getByRole('textbox', { name: 'Prop Name' }).fill('nodeId');
  await dialog.getByRole('checkbox', { name: /Primary Key/ }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(dialog).toBeHidden();
}
test('a saved sketch restores node definitions after leaving and reloading', async ({ page, api }) => {
  await page.goto('/studio/schema-manager/graphtype/create');
  await page.locator('input[name=graphTypeName]').fill('DraftPeople');
  await addNode(page, 'Employee');
  await page.getByRole('button', { name: 'Visual Builder' }).click();
  await page.getByRole('button', { name: 'Save As Sketch' }).click();
  await expect(page.getByText('Sketch Save Success')).toBeVisible();
  expect(JSON.parse(api.sketch!.schema).nodes[0].name).toBe('Employee');
  await page.goto('/studio/schema-manager/graphtype/sketch');
  await page.locator('.MuiCard-root').filter({ hasText: 'DraftPeople' }).locator('img').first().click();
  await expect(page).toHaveURL(/sketch\/1$/);
  await page.reload();
  await expect(page.locator('input[name=graphTypeName]')).toHaveValue('DraftPeople');
  await page.getByRole('button', { name: 'Node Type', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Employee', exact: true })).toBeVisible();
});
test('validates the GraphType form, retries rejected DDL and reloads the submitted node with a slow layout service', async ({
  page,
  api,
}) => {
  let writes = 0;
  let ddl = '';
  const layout = gate();
  const readingLayout = gate();
  api.override = async (path, req) => {
    if (path.includes('/global-config/') && path.includes('Team')) {
      readingLayout.release();
      await layout.pending;
      return ok();
    }
    if (path !== '/gql/exec') return;
    const { gql } = req.postDataJSON();
    if (/^CREATE GRAPH TYPE/i.test(gql)) {
      if (++writes === 1) return failure('DDL rejected');
      ddl = gql;
      api.types.push('Team');
      return table([]);
    }
    if (gql.startsWith('CALL describe_graph_type("Team")') && ddl.includes('Employee'))
      return table([
        { type_name: 'Employee', entity_type: 'Node', labels: [], 'primary_key/multiedge_key': ['nodeId'] },
      ]);
    if (gql.includes('describe_node_type') && ddl.includes('nodeId'))
      return table([
        { type_name: 'Employee', property_name: 'nodeId', data_type: 'STRING', primary_key: 'Y', nullable: false },
      ]);
    return undefined;
  };
  await page.goto('/studio/schema-manager/graphtype/create');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.click();
  await expect(page.locator('input[name=graphTypeName]')).toBeVisible();
  expect(writes).toBe(0);
  await page.locator('input[name=graphTypeName]').fill('Team');
  await addNode(page, 'Employee');
  await next.click();
  const create = page.getByRole('button', { name: 'Create Graph Type', exact: true }).last();
  await create.click();
  await expect(page.getByRole('alert')).toContainText('DDL rejected');
  await create.click();
  await expect(page).toHaveURL(/graphtype\/?$/);
  expect(ddl).toContain('Employee');
  expect(ddl).toContain('nodeId');
  await page.getByText('Team', { exact: true }).last().click();
  await expect(page).toHaveURL(/\/view\/Team$/);
  await page.getByRole('button', { name: 'Edit Graph Type' }).click();
  await page.getByRole('button', { name: 'Node Type', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Employee', exact: true })).toBeVisible();
  await readingLayout.pending;
  layout.release();
});
