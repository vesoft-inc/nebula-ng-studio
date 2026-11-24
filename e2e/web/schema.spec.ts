import { expect } from '@playwright/test';
import { test } from '../support/web';
import { failure, table } from '../support/http';
import { serveGraph } from '../support/explorer';

test('creates a schema and requires its exact path before dropping it', async ({ page, api }) => {
  const schema = '/workspace';
  api.schemaPaths.push('/default_schema');
  let drops = 0;
  api.override = async (path, request) => {
    if (path !== '/gql/exec') return;
    const { gql } = request.postDataJSON();
    if (gql === 'CREATE SCHEMA `/workspace`') {
      api.schemaPaths.push(schema);
      return table([]);
    }
    if (gql === 'DROP SCHEMA IF EXISTS `/workspace`') {
      drops++;
      api.schemaPaths = api.schemaPaths.filter((item) => item !== schema);
      return table([]);
    }
    return undefined;
  };

  const catalog = '/studio/schema-list';
  const card = page.getByRole('button', { name: 'Path: ' + schema, exact: true });
  const dialog = page.getByRole('dialog');
  await page.goto(catalog);
  await page.getByRole('button', { name: 'Create Schema', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Path' }).fill(schema);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/schema-manager\/graphtype$/);
  expect(api.schema).toBe(schema);

  await page.goto(catalog);
  await page.getByRole('button', { name: 'Schema actions: ' + schema }).click();
  await page.getByText('Delete', { exact: true }).click();
  const confirm = dialog.getByRole('button', { name: 'Delete', exact: true });
  await dialog.getByRole('textbox', { name: 'Path' }).fill('/other');
  await confirm.click();
  await expect(page.getByText('Schema verification failed')).toBeVisible();
  expect(drops).toBe(0);
  await dialog.getByRole('textbox', { name: 'Path' }).fill(schema);
  await confirm.click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Path: /other', exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);
  expect(drops).toBe(1);
  expect(api.schema).toBe('/default_schema');
});

test('graph creation recovers from a failed refresh and deletion persists after reload', async ({ page, api }) => {
  const name = 'saved-graph';
  let writes = 0;
  let failRefresh = false;
  api.override = async (path, request) => {
    if (path !== '/gql/exec') return;
    const { gql } = request.postDataJSON();
    if (gql.startsWith('CREATE GRAPH ')) {
      if (++writes === 1) return failure('Graph creation refused');
      failRefresh = true;
    } else if (gql === 'DROP GRAPH IF EXISTS `saved-graph`') {
      api.graphs = api.graphs.filter((graph) => graph !== name);
      return table([]);
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

  const createdGraph = page.locator('.MuiCard-root').filter({ hasText: name });
  await createdGraph.getByRole('button').click();
  await page.getByText('Delete', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByText('people-demo', { exact: true }).last()).toBeVisible();
  await expect(createdGraph).toHaveCount(0);
});

test('creates and drops a graph index and refreshes graph statistics', async ({ page, api }) => {
  const original = {
    name: 'by_name',
    state: 'ONLINE',
    index_type: 'NORMAL',
    entity_type: 'Node',
    element_type: 'Person',
    properties: ['name'],
  };
  const indexes = [original];
  let statsReady = false;
  serveGraph(api, (gql) => {
    if (gql === 'CALL describe_graph("people-demo") CALL describe_graph_type(graph_type_name) return *') {
      return table([
        {
          graph_name: 'people-demo',
          graph_type_name: 'People',
          type_name: 'Person',
          entity_type: 'Node',
          properties: ['name', 'age'],
        },
      ]);
    }
    if (gql === 'USE `people-demo` SHOW INDEXES') return table(indexes);
    if (gql === 'USE `people-demo` CREATE INDEX `by_age` ON Node `Person` (`age` ASC)') {
      indexes.push({ ...original, name: 'by_age', properties: ['age'] });
      return table([]);
    }
    if (gql === 'USE `people-demo` DROP INDEX IF EXISTS `by_age`') {
      indexes.splice(1, 1);
      return table([]);
    }
    if (gql === 'SUBMIT JOB STATS `people-demo`') {
      statsReady = true;
      return table([]);
    }
    if (gql === 'USE `people-demo` SHOW STATS' && statsReady) {
      return table([
        { entry_name: 'All nodes', element_type: 'Node', total_num: 7 },
        { entry_name: 'All edges', element_type: 'Edge', total_num: 3 },
        { entry_name: 'Person', element_type: 'Node', total_num: 7 },
      ]);
    }
    return undefined;
  });

  await page.goto('/studio/schema-manager/graphs/people-demo');
  const dialog = page.getByRole('dialog');
  const survivor = page.getByRole('row').filter({ hasText: 'by_name' });
  const created = page.getByRole('row').filter({ hasText: 'by_age' });
  await expect(survivor).toBeVisible();
  await page.getByRole('button', { name: 'Create Index', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Index Name' }).fill('by_age');
  await dialog.getByRole('combobox', { name: 'ON' }).fill('Person');
  await page.getByRole('option', { name: 'Person', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add Property', exact: true }).click();
  await dialog.getByRole('combobox', { name: '', exact: true }).first().click();
  await page.getByRole('option', { name: 'age', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(created.getByRole('cell', { name: 'age', exact: true })).toBeVisible();
  await page.reload();
  await expect(created).toBeVisible();
  await created.getByRole('button').click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(created).toHaveCount(0);
  await expect(survivor).toBeVisible();

  await page.getByRole('button', { name: 'Statistic', exact: true }).click();
  const personStats = page.getByRole('row').filter({ hasText: 'Person' });
  await expect(personStats).toHaveCount(0);
  await page.getByRole('button', { name: 'Execute Stats' }).click();
  await expect(personStats.getByRole('cell', { name: '7', exact: true })).toBeVisible();
  expect(statsReady).toBe(true);
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
