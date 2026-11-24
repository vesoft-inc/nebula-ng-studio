import { expect, type Page } from '@playwright/test';
import type { StudioApi } from './web';
import { table, type Reply } from './http';

export const graphTypes = '/studio/schema-manager/graphtype';
export const schemaCanvas = (page: Page) => page.locator('.react-flow');
export const schemaNode = (page: Page, name: string) =>
  schemaCanvas(page)
    .locator('.react-flow__node')
    .filter({ has: page.getByText(name, { exact: true }) });

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

export function serveSchemaType(
  api: StudioApi,
  rows: { node: PropertyRow[]; edge: PropertyRow[] },
  write: (ddl: string) => Reply | undefined
) {
  api.override = async (path, request) => {
    if (path !== '/gql/exec' || request.method() !== 'POST') return;
    const { gql } = request.postDataJSON() as { gql: string };
    if (gql === 'CALL describe_graph_type("People") RETURN *') {
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
    if (gql.startsWith('LET gtn = "People"') && gql.includes('CALL describe_node_type')) {
      return table([
        ...rows.node.map((row) => ({ ...row, type_name: 'Person' })),
        { ...identifier, type_name: 'Company' },
      ]);
    }
    if (gql.startsWith('LET gtn = "People"') && gql.includes('CALL describe_edge_type')) {
      return table(rows.edge.map((row) => ({ ...row, type_name: 'WorksAt' })));
    }
    return write(gql);
  };
  api.config.set(
    'studio-schema-layout-v1|graphd:9669|alice|~2finitial|People',
    JSON.stringify({
      version: 1,
      address: 'graphd:9669',
      username: 'alice',
      schemaPath: '/initial',
      graphTypeName: 'People',
      nodes: { Person: { x: 150, y: 150 }, Company: { x: 550, y: 200 } },
    })
  );
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
