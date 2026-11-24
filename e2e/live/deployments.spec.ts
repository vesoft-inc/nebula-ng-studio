import { expect, test, type APIResponse, type Page, type Response } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { SnapshotPayload } from '../../packages/studio-ui-internal/src/contracts/snapshot';
import { signIn, runQuery, disconnect } from '../support/browser';
import { graphCanvas, selected } from '../support/explorer';
import { addCanvasNode, connectNodes, schemaCanvas, schemaNode } from '../support/schema';

const env = process.env;
const web = env.STUDIO_INTEGRATION_BASE_URL;
const address = env.STUDIO_INTEGRATION_GRAPHD_ADDRESS;
const username = env.STUDIO_INTEGRATION_GRAPHD_USERNAME;
const password = env.STUDIO_INTEGRATION_GRAPHD_PASSWORD;
const gui = env.GUI_INTEGRATION_BASE_URL;
const guiUser = env.GUI_INTEGRATION_USERNAME;
const guiPassword = env.GUI_INTEGRATION_PASSWORD;
const writeSchema = env.STUDIO_INTEGRATION_WRITE_SCHEMA;
const graphTypesPath = '/schema-manager/graphtype';

const studioUrl = (path: string) => web!.replace(/\/$/, '') + path;
const studioApi = (page: Page, path: string) => new URL('/api-studio' + path, page.url()).href;
const uniqueName = () => 'studio_e2e_' + randomUUID().replaceAll('-', '');

async function webLogin(page: Page, path: string) {
  const host = new URL('http://' + address);
  await page.goto(studioUrl(path));
  await signIn(page, username!, password!, host.hostname, host.port);
}

async function studioData<T>(response: Response | APIResponse, operation: string): Promise<T> {
  expect(response.ok(), operation + ' HTTP status ' + response.status()).toBe(true);
  const { code, data } = await response.json();
  expect(code, operation + ' business status').toBe(0);
  return data;
}

async function execGql<Row = unknown>(page: Page, gql: string) {
  const response = await page.request.post(studioApi(page, '/gql/exec'), { data: { gql } });
  return studioData<{ tables: Row[] }>(response, gql);
}

async function selectWriteSchema(page: Page, schema: string) {
  await webLogin(page, '/schema-list');
  await page.getByRole('button', { name: 'Path: ' + schema, exact: true }).click();
  await expect(page).toHaveURL(studioUrl(graphTypesPath));
  const current = await execGql<{ path: string }>(page, 'SHOW CURRENT_SCHEMA');
  expect(current.tables.map(({ path }) => path)).toEqual([schema]);
}

function snapshotResponse(response: Response, method: string, path?: string) {
  const endpoint = new URL(response.url()).pathname;
  return response.request().method() === method && endpoint === '/api-studio/explorer/snapshots' + (path ?? '');
}

interface StoredSnapshot {
  id: string;
  graph: string;
  graph_type: string;
  schemaPath: string;
  data: string;
}

test.describe('Studio Server and Graphd', () => {
  test.skip(!(web && address && username && password), 'Studio deployment and Graphd credentials required');
  test('signs in, reads the server version, opens Schema and disconnects', async ({ page }) => {
    await webLogin(page, '/console');
    await runQuery(page, 'SHOW VERSION');
    await expect(page.getByRole('cell', { name: /\d+\.\d+/ }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Schema', exact: true }).click();
    await expect(page.getByRole('heading', { name: /graph type list/i })).toBeVisible();
    await disconnect(page, username!);
    await expect(page.locator('input[name=password]')).toBeVisible();
  });
  test('reads back a new graph after reload in the explicitly selected test schema', async ({ page }) => {
    const type = env.STUDIO_INTEGRATION_GRAPH_TYPE;
    test.skip(!(writeSchema && type), 'Requires a dedicated writable test schema and an existing graph type');
    const name = uniqueName();
    await selectWriteSchema(page, writeSchema!);
    await page.getByText('Graph', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Create Graph', exact: true }).last().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: type!, exact: true }).click();
    await dialog.locator('input[name=graphName]').fill(name);
    try {
      await dialog.getByRole('button', { name: 'Confirm' }).click();
      await expect(dialog).toBeHidden();
      await page.reload();
      await expect(page.getByText(name, { exact: true }).last()).toBeVisible();
    } finally {
      await execGql(page, 'DROP GRAPH IF EXISTS `' + name + '`');
    }
  });

  test('reads back the GraphType submitted from the Schema canvas', async ({ page }) => {
    test.skip(!writeSchema, 'Requires a dedicated writable test schema');
    test.setTimeout(90000);
    const name = uniqueName();
    await selectWriteSchema(page, writeSchema!);
    await page.goto(studioUrl(graphTypesPath + '/create'));
    await page.getByRole('textbox', { name: 'Graph Type Name' }).fill(name);
    for (const [node, position] of [
      ['Person', 0.21],
      ['Company', 0.36],
    ] as const) {
      await addCanvasNode(page, node, position);
      await page.getByRole('checkbox', { name: 'Primary Key: id' }).check();
      await schemaCanvas(page)
        .locator('.react-flow__pane')
        .click({ position: { x: 105, y: 120 } });
    }
    await connectNodes(
      page,
      schemaNode(page, 'Person').locator('.react-flow__handle.source[data-handlepos="right"]'),
      schemaNode(page, 'Company').locator('.react-flow__handle.target[data-handlepos="left"]')
    );
    await page.getByRole('textbox', { name: 'Edge Type Name' }).fill('WorksAt');
    await page.getByRole('button', { name: 'Add Property', exact: true }).click();
    await page.getByRole('textbox', { name: 'Prop Name' }).fill('department');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    try {
      await page.getByRole('button', { name: 'Create Graph Type', exact: true }).last().click();
      await expect(page).toHaveURL(studioUrl(graphTypesPath));

      const { tables: types } = await execGql<{ type_name: string; entity_type: string; type_pattern: string }>(
        page,
        `CALL describe_graph_type("${name}") RETURN *`
      );
      expect(types.map(({ entity_type, type_name }) => entity_type + ' ' + type_name).sort()).toEqual([
        'Edge WorksAt',
        'Node Company',
        'Node Person',
      ]);
      expect(types.find(({ type_name }) => type_name === 'WorksAt')?.type_pattern.replace(/[\s`]/g, '')).toBe(
        '(Person)-[WorksAt]->(Company)'
      );

      for (const node of ['Person', 'Company']) {
        const { tables } = await execGql(page, `CALL describe_node_type("${name}", "${node}") RETURN *`);
        expect(tables).toContainEqual(
          expect.objectContaining({ property_name: 'id', data_type: 'STRING', nullable: false, primary_key: 'Y' })
        );
      }
      const { tables: edge } = await execGql(page, `CALL describe_edge_type("${name}", "WorksAt") RETURN *`);
      expect(edge).toContainEqual(expect.objectContaining({ property_name: 'department', data_type: 'STRING' }));

      await page.goto(studioUrl(graphTypesPath + '/view/' + name));
      await expect(schemaNode(page, 'Person')).toBeVisible();
      await expect(schemaNode(page, 'Company')).toBeVisible();
      await expect(schemaCanvas(page).locator('.react-flow__edge-path')).toHaveAttribute(
        'marker-end',
        'url(#arrow-forward)'
      );
    } finally {
      await execGql(page, `DROP GRAPH TYPE IF EXISTS \`${name}\``);
    }
  });

  test('saves a Console graph result in Explorer and reopens it in a fresh page', async ({ page, context }) => {
    test.skip(!writeSchema, 'Requires a dedicated writable test schema and Studio snapshot storage');
    test.setTimeout(90000);
    const graph = uniqueName();
    const type = uniqueName();
    let snapshotPath: string | undefined;
    await selectWriteSchema(page, writeSchema!);

    try {
      await execGql(
        page,
        [
          `CREATE GRAPH TYPE \`${type}\` AS {`,
          'NODE `Person` ({`id` STRING NOT NULL, PRIMARY KEY(`id`)}),',
          'NODE `Company` ({`id` STRING NOT NULL, PRIMARY KEY(`id`)}),',
          'EDGE `WorksAt` (`Person`)-[ {`department` STRING}]->(`Company`)',
          '}',
        ].join('\n')
      );
      await execGql(page, `CREATE GRAPH \`${graph}\` :: \`${type}\``);
      const useGraph = 'USE `' + graph + '` ';
      await execGql(page, useGraph + 'INSERT (@`Person`{`id`: "Ada"}), (@`Company`{`id`: "Acme"})');
      await execGql(
        page,
        useGraph +
          'MATCH (a@`Person` where a.id = "Ada"), (b@`Company` where b.id = "Acme") ' +
          'INSERT (a)-[@`WorksAt`{`department`: "Research"}]->(b)'
      );

      await page.getByRole('tab', { name: 'Console', exact: true }).click();
      await runQuery(page, useGraph + 'MATCH (a@`Person`)-[e@`WorksAt`]->(b@`Company`) RETURN a, e, b');
      await page.getByRole('tab', { name: 'Graph', exact: true }).click();
      const [created] = await Promise.all([
        page.waitForResponse((response) => snapshotResponse(response, 'POST')),
        page.getByRole('button', { name: 'Explore in Explorer' }).click(),
      ]);
      const { id } = await studioData<{ id: string }>(created, 'Create snapshot from Console');
      expect(id).toBeTruthy();
      snapshotPath = '/' + encodeURIComponent(id);
      const endpoint = studioApi(page, '/explorer/snapshots' + snapshotPath);
      const detailUrl = studioUrl('/explorer/snapshots' + snapshotPath);
      await expect(page).toHaveURL(detailUrl);
      const original = await studioData<StoredSnapshot>(await page.request.get(endpoint), 'Read Console snapshot');
      expect((JSON.parse(original.data) as SnapshotPayload).linksSelected).toEqual([]);

      await page.getByRole('button', { name: 'Search in Exploration' }).click();
      await page.getByRole('combobox', { name: 'Search in Exploration' }).fill('Research');
      await page.getByRole('option').filter({ hasText: 'Research' }).click();
      await expect(selected(page, 0, 1)).toBeVisible();

      const [saved] = await Promise.all([
        page.waitForResponse((response) => snapshotResponse(response, 'PUT', snapshotPath)),
        page.getByRole('button', { name: 'Save', exact: true }).click(),
      ]);
      await studioData(saved, 'Save Explorer selection');
      await expect(page.getByText('Save Success', { exact: true })).toBeVisible();

      const reopened = await context.newPage();
      try {
        const [response] = await Promise.all([
          reopened.waitForResponse((response) => snapshotResponse(response, 'GET', snapshotPath)),
          reopened.goto(detailUrl),
        ]);
        const stored = await studioData<StoredSnapshot>(response, 'Read saved Explorer snapshot');
        expect(stored).toMatchObject({ id, graph, graph_type: type, schemaPath: writeSchema });
        const payload = JSON.parse(stored.data) as SnapshotPayload;
        expect(payload.nodes).toHaveLength(2);
        expect(payload.links).toHaveLength(1);
        expect(payload.linksSelected).toEqual(payload.links);
        expect(payload.nodesSelected).toEqual([]);
        const link = payload.nowDataMap[payload.links[0]];
        expect(link).toMatchObject({
          data: {
            type: 'EDGE',
            value: { graph, type: 'WorksAt', isDirected: true, properties: { department: 'Research' } },
          },
        });
        expect(payload.nodes).toEqual(expect.arrayContaining([link.source, link.target]));
        expect(payload.nowDataMap[String(link.source)]).toMatchObject({
          data: { type: 'NODE', value: { graph, type: 'Person', properties: { id: 'Ada' } } },
        });
        expect(payload.nowDataMap[String(link.target)]).toMatchObject({
          data: { type: 'NODE', value: { graph, type: 'Company', properties: { id: 'Acme' } } },
        });
        await expect(reopened).toHaveURL(detailUrl);
        await expect(graphCanvas(reopened)).toBeVisible();
        await expect(selected(reopened, 0, 1)).toBeVisible();
      } finally {
        await reopened.close();
      }
    } finally {
      try {
        if (snapshotPath) {
          await studioData(
            await page.request.delete(studioApi(page, '/explorer/snapshots' + snapshotPath)),
            'Delete test snapshot'
          );
        }
      } finally {
        await execGql(page, `DROP GRAPH IF EXISTS \`${graph}\``);
        await execGql(page, `DROP GRAPH TYPE IF EXISTS \`${type}\``);
      }
    }
  });
});
async function guiLogin(page: Page) {
  await page.goto(gui!.replace(/\/$/, '') + '/ui/console');
  await signIn(page, guiUser!, guiPassword!);
  await expect(page.getByRole('dialog')).toBeHidden();
}
test.describe('GUI deployment', () => {
  test.skip(!(gui && guiUser && guiPassword), 'GUI deployment and credentials required');
  test('reads the server version after GUI authentication', async ({ page }) => {
    await guiLogin(page);
    await runQuery(page, 'SHOW VERSION');
    await expect(page.getByRole('cell', { name: /\d+\.\d+/ }).first()).toBeVisible();
  });
  test('cancels a running read-only query then runs a fresh query', async ({ page }) => {
    test.skip(!env.GUI_INTEGRATION_LONG_QUERY, 'Requires an operator-provided cancellable read-only query');
    await guiLogin(page);
    await runQuery(page, env.GUI_INTEGRATION_LONG_QUERY!);
    const accepted = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && /\/sessions\/[^/]+\/query$/.test(new URL(r.url()).pathname)
    );
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    expect((await accepted).ok()).toBeTruthy();
    await runQuery(page, 'SHOW VERSION');
    await expect(page.getByRole('cell', { name: /\d+\.\d+/ }).first()).toBeVisible();
  });
});
