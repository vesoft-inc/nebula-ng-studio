import { expect, type Locator, type Page } from '@playwright/test';
import type { StudioApi } from './web';
import { table, type Reply } from './http';

export const graphTypes = '/studio/schema-manager/graphtype';
export const schemaCanvas = (page: Page) => page.locator('.react-flow');
export const schemaNode = (page: Page, name: string) =>
  schemaCanvas(page)
    .locator('.react-flow__node')
    .filter({ has: page.getByText(name, { exact: true }) });

export async function drag(page: Page, from: Locator, to: { x: number; y: number }) {
  await from.hover();
  const box = (await from.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

export async function connectNodes(page: Page, from: Locator, to: Locator) {
  await from.hover();
  await expect(to).toBeVisible();
  const target = (await to.boundingBox())!;
  await drag(page, from, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
}

export async function addCanvasNode(page: Page, name: string, horizontal: number) {
  const pane = schemaCanvas(page).locator('.react-flow__pane');
  await expect(pane).toBeVisible();
  const { width, height } = (await pane.boundingBox())!;
  await page
    .locator('[draggable="true"]')
    .filter({ hasText: /^Add$/ })
    .dragTo(pane, {
      targetPosition: { x: Math.round(width * horizontal), y: Math.round(height * 0.42) },
    });
  const nodeName = page.getByRole('textbox', { name: 'Node type name' });
  await expect(nodeName).toHaveValue('');
  await nodeName.fill(name);
  await expect(schemaNode(page, name)).toBeVisible();
  await page.getByRole('button', { name: 'Add Property', exact: true }).click();
  await page.getByRole('textbox', { name: 'Prop Name' }).fill('id');
}

type PropertyRow = {
  property_name: string;
  data_type: string;
  primary_key?: 'Y' | 'N';
  multi_edge_key?: 'Y' | 'N';
  nullable: boolean;
  default?: string;
};

export const identifier: PropertyRow = {
  property_name: 'id',
  data_type: 'STRING',
  primary_key: 'Y',
  nullable: false,
};

export interface SchemaTypeFixture {
  schemaPath: string;
  name: string;
  node: PropertyRow[];
  edge: PropertyRow[];
}

export function serveSchemaTypes(
  api: StudioApi,
  types: SchemaTypeFixture[],
  alter?: (type: SchemaTypeFixture, ddl: string) => Reply
) {
  api.override = async (path, request) => {
    if (path !== '/gql/exec' || request.method() !== 'POST') return;
    const { gql } = request.postDataJSON() as { gql: string };
    const list = types.filter((type) => type.schemaPath === api.schema);
    if (gql === 'SHOW GRAPH TYPES') {
      return table(list.map(({ name }) => ({ graph_type: name, owner: api.user })));
    }
    const target = gql.match(/^(?:CALL describe_graph_type\("|LET gtn = ")([^"]+)"|^ALTER GRAPH TYPE `([^`]+)` /);
    const type = list.find(({ name }) => name === (target?.[1] ?? target?.[2]));
    if (!type) return;
    if (gql === `CALL describe_graph_type("${type.name}") RETURN *`) {
      return table([
        { type_name: 'Person', entity_type: 'Node', labels: ['Member'] },
        { type_name: 'Company', entity_type: 'Node', labels: [] },
        {
          type_name: 'WorksAt',
          entity_type: 'Edge',
          labels: [],
          type_pattern: '(Person)-[WorksAt]->(Company)',
          'primary_key/multiedge_key': 'Unique',
        },
      ]);
    }
    if (gql.startsWith(`LET gtn = "${type.name}"`) && gql.includes('CALL describe_node_type')) {
      return table([
        ...type.node.map((row) => ({ ...row, type_name: 'Person' })),
        { ...identifier, type_name: 'Company' },
      ]);
    }
    if (gql.startsWith(`LET gtn = "${type.name}"`) && gql.includes('CALL describe_edge_type')) {
      return table(type.edge.map((row) => ({ ...row, type_name: 'WorksAt' })));
    }
    return target?.[2] ? alter?.(type, gql) : undefined;
  };
  for (const { name, schemaPath } of types) {
    api.config.set(
      'studio-schema-layout-v1|graphd:9669|alice|' + schemaPath.replaceAll('/', '~2f') + '|' + name,
      JSON.stringify({
        version: 1,
        address: 'graphd:9669',
        username: 'alice',
        schemaPath,
        graphTypeName: name,
        nodes: { Person: { x: 150, y: 150 }, Company: { x: 550, y: 200 } },
      })
    );
  }
}

export async function openTypeOnCanvas(page: Page, entity: 'node' | 'edge') {
  if (entity === 'node') {
    await schemaNode(page, 'Person').click();
    await expect(page.getByRole('textbox', { name: 'Node type name' })).toHaveValue('Person');
    return;
  }
  // The SVG path, rather than the HTML edge label, handles React Flow clicks.
  const path = schemaCanvas(page).locator('.react-flow__edge-interaction');
  await expect(path).toBeVisible();
  const name = page.getByRole('textbox', { name: 'Edge Type Name' });
  await expect(async () => {
    const point = await path.evaluate((element) => {
      const line = element as unknown as SVGPathElement;
      const matrix = line.getScreenCTM()!;
      for (const fraction of [0.3, 0.7, 0.4, 0.6]) {
        const { x, y } = line.getPointAtLength(line.getTotalLength() * fraction).matrixTransform(matrix);
        if (document.elementFromPoint(x, y) === element) return { x, y };
      }
      return null;
    });
    expect(point, 'an unobscured point on the rendered edge').not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
    await expect(name).toHaveValue('WorksAt', { timeout: 350 });
  }).toPass({ timeout: 7500 });
}
