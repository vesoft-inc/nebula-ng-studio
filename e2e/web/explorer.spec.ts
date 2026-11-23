import { expect } from '@playwright/test';
import { test } from '../support/web';
import { failure, table } from '../support/http';
test('a snapshot survives creation, failed rename, retry, reload and deletion', async ({ page, api }) => {
  await page.goto('/studio/explorer/snapshots');
  await page.getByRole('button', { name: 'New Exploration' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name=name]').fill('Original exploration');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'people-demo' }).click();
  await dialog.getByRole('button', { name: /confirm|create/i }).click();
  await expect(page).toHaveURL(/snapshots\/1$/);
  await expect(page.getByText('Original exploration', { exact: true }).first()).toBeVisible();
  await page.goBack();
  const card = page.locator('.MuiCard-root').filter({ hasText: 'Original exploration' });
  await card.getByRole('button', { name: '', exact: true }).click();
  await page.getByText('Edit', { exact: true }).click();
  await dialog.locator('input[name=name]').fill('Renamed exploration');
  let writes = 0;
  api.override = async (path, req) =>
    path === '/explorer/snapshots/1' && req.method() === 'PUT' && ++writes === 1
      ? failure('Rename refused')
      : undefined;
  await dialog.getByRole('button', { name: /update/i }).click();
  await expect(page.getByText('Rename refused')).toBeVisible();
  await dialog.getByRole('button', { name: /update/i }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  const renamed = page.locator('.MuiCard-root').filter({ hasText: 'Renamed exploration' });
  await expect(renamed).toBeVisible();
  await renamed.getByRole('button', { name: '', exact: true }).click();
  await page.getByText(/Delete Exploration/i).click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(renamed).toBeHidden();
  await page.reload();
  await expect(page.getByText('Start graph exploration')).toBeVisible();
});

test('dirty snapshot navigation supports staying, failed save, retry and discard', async ({ page, api }) => {
  api.snapshots.set('A', { id: 'A', name: 'Filter workspace', graph: 'people-demo', schemaPath: '/initial', data: '' });
  const path = '/studio/explorer/snapshots/A';
  const filters = page.getByRole('button', { name: 'Exploration Result Filter' });
  const hide = page.getByRole('radio', { name: 'Hide', exact: true });
  const consoleTab = page.getByRole('tab', { name: 'Console', exact: true });
  const dialog = page.getByRole('dialog');
  await page.goto(path);
  await filters.click();
  await hide.press('Space');
  await expect(hide).toBeChecked();
  await consoleTab.click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(path);
  let saves = 0;
  api.override = async (path, req) =>
    path.endsWith('/snapshots/A') && req.method() === 'PUT' && ++saves === 1 ? failure('Save refused') : undefined;
  await consoleTab.click();
  await dialog.getByRole('button', { name: 'Save & Leave' }).click();
  await expect(page.getByText('Save refused')).toBeVisible();
  await expect(page).toHaveURL(path);
  await dialog.getByRole('button', { name: 'Save & Leave' }).click();
  await expect(page).toHaveURL(/\/console$/);
  await page.goto(path);
  await filters.click();
  await expect(hide).toBeChecked();
  const dismiss = page.getByRole('radio', { name: 'Dismiss' });
  await dismiss.press('Space');
  await expect(dismiss).toBeChecked();
  await consoleTab.click();
  await dialog.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page).toHaveURL(/\/console$/);
  await page.goto(path);
  await filters.click();
  await expect(hide).toBeChecked();
  expect(saves).toBe(2);
});

test('a missing deep link recovers through the list and opens the selected snapshot', async ({ page, api }) => {
  for (const id of ['first', 'second'])
    api.snapshots.set(id, { id, name: 'Project ' + id, graph: 'people-demo', schemaPath: '/initial', data: '' });
  await page.goto('/studio/explorer/snapshots/missing');
  await expect(page.getByText(/snapshot missing|unable to open this exploration/i).first()).toBeVisible();
  for (const id of ['first', 'second']) {
    await page.getByRole('tab', { name: 'Explorer', exact: true }).click();
    await page.getByRole('button', { name: 'Project ' + id, exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/snapshots/' + id + '$'));
    await expect(page.getByText('Project ' + id, { exact: true })).toBeVisible();
  }
});

test('display properties are read back from the saved snapshot', async ({ page, api }) => {
  api.snapshots.set('people', {
    id: 'people',
    name: 'People labels',
    graph: 'people-demo',
    graph_type: 'People',
    schemaPath: '/initial',
    data: '',
  });
  api.override = async (path, req) => {
    if (path !== '/gql/exec') return;
    const { gql } = req.postDataJSON();
    if (gql === 'CALL describe_graph_type("People") RETURN *')
      return table([
        {
          type_name: 'Person',
          entity_type: 'Node',
          labels: ['Person'],
          properties: ['id', 'nickname'],
          'primary_key/multiedge_key': ['id'],
        },
      ]);
    if (gql.includes('CALL describe_node_type(gtn, type_name)'))
      return table(
        ['id', 'nickname'].map((property_name) => ({
          type_name: 'Person',
          property_name,
          data_type: 'STRING',
          primary_key: property_name === 'id' ? 'Y' : 'N',
        }))
      );
    return undefined;
  };
  await page.goto('/studio/explorer/snapshots/people');
  const properties = page.getByRole('button', { name: 'Graph Property' });
  await properties.click();
  const field = page.getByRole('checkbox', { name: 'nickname' });
  await expect(field).not.toBeChecked();
  await field.press('Space');
  await expect(field).toBeChecked();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => api.snapshots.get('people')!.data).toContain('nickname');
  await page.reload();
  await properties.click();
  await expect(field).toBeChecked();
});
