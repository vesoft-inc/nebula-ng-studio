import { expect, type Locator, type Page } from '@playwright/test';
import type { StudioApi } from './web';
import { table, type Reply } from './http';

export const snapshots = '/studio/explorer/snapshots';
const graph = 'people-demo';
export const alex = {
  id: 11,
  type: 'Person',
  color: '#bd1764',
  x: -130,
  y: -55,
  properties: { name: 'Alex', age: 36 },
};
export const neha = { id: 12, type: 'Person', color: '#148947', x: -30, y: 100, properties: { name: 'Neha', age: 24 } };
export const acme = { id: 13, type: 'Company', color: '#2547c9', x: 140, y: -55, properties: { name: 'Acme' } };
export type CanvasNode = Pick<typeof alex, 'id' | 'type'> & { properties: Record<string, string | number> };
export const asNode = ({ id, type, properties }: CanvasNode) => ({
  type: 'NODE',
  raw: String(id),
  value: { id, graph, type, labels: ['Fixture'], properties },
});
export const worksAt = {
  srcId: alex.id,
  dstId: acme.id,
  graph,
  type: 'WorksAt',
  isDirected: true,
  rank: 0,
  labels: [],
  properties: { since: 2021 },
};
export const edgeColor = '#bb6219';
export const edgeId = JSON.stringify(['EDGE', graph, 'WorksAt', 'DIRECTED', '11', '13', '0']);

export function seedGraph(api: StudioApi, id: string, options: { edge?: boolean; schemaPath?: string } = {}) {
  const { edge = true, schemaPath = '/initial' } = options;
  const nodes = [alex, neha, acme];
  const entities = Object.fromEntries(
    nodes.map((node) => [
      String(node.id),
      {
        id: String(node.id),
        x: node.x,
        y: node.y,
        fx: node.x,
        fy: node.y,
        color: node.color,
        label: node.properties.name,
        data: asNode(node),
      },
    ])
  );
  const edgeData = edge
    ? {
        [edgeId]: {
          id: edgeId,
          source: String(alex.id),
          target: String(acme.id),
          color: edgeColor,
          label: 'WorksAt',
          lineWidth: 3,
          edgeType: 'WorksAt',
          isDirected: true,
          data: { type: 'EDGE', raw: 'Alex -> Acme', value: worksAt },
        },
      }
    : {};
  api.snapshots.set(id, {
    id,
    name: 'Canvas ' + id,
    graph,
    graph_type: 'People',
    schemaPath,
    data: JSON.stringify({
      nodes: nodes.map(({ id }) => String(id)),
      links: Object.keys(edgeData),
      nowDataMap: { ...entities, ...edgeData },
    }),
  });
  return snapshots + '/' + id;
}

export function serveGraph(api: StudioApi, gqlReply?: (gql: string) => Reply | undefined | Promise<Reply | undefined>) {
  api.override = async (path, request) => {
    if (path !== '/gql/exec' || request.method() !== 'POST') return;
    const { gql } = request.postDataJSON() as { gql: string };
    if (gql === 'CALL describe_graph_type("People") RETURN *') {
      return table([
        {
          type_name: 'Person',
          entity_type: 'Node',
          labels: ['Fixture'],
          properties: ['name', 'age'],
          'primary_key/multiedge_key': ['name'],
        },
        {
          type_name: 'Company',
          entity_type: 'Node',
          labels: ['Fixture'],
          properties: ['name'],
          'primary_key/multiedge_key': ['name'],
        },
        {
          type_name: 'WorksAt',
          entity_type: 'Edge',
          labels: [],
          properties: ['since'],
          type_pattern: '(Person)-[WorksAt]->(Company)',
          'primary_key/multiedge_key': 'Unique',
        },
      ]);
    }
    if (gql.includes('CALL describe_node_type(gtn, type_name)')) {
      return table([
        ...['Person', 'Company'].map((type_name) => ({
          type_name,
          property_name: 'name',
          data_type: 'STRING',
          primary_key: 'Y',
          nullable: false,
        })),
        { type_name: 'Person', property_name: 'age', data_type: 'INT32', primary_key: 'N', nullable: false },
      ]);
    }
    if (gql.includes('CALL describe_edge_type(gtn, type_name)')) {
      return table([
        { type_name: 'WorksAt', property_name: 'since', data_type: 'INT32', multi_edge_key: 'N', nullable: true },
      ]);
    }
    return gqlReply?.(gql);
  };
}

export const graphCanvas = (page: Page) => page.locator('[tabindex="0"] > .force-graph-container > canvas');
export const selected = (page: Page, nodes: number, edges: number) =>
  page.getByRole('button', { name: new RegExp('Selected Nodes\\s*' + nodes + '\\s*Selected Edges\\s*' + edges + '$') });
export const selectedEntities = (page: Page) => page.getByRole('button', { name: /Selected Nodes.*Selected Edges/ });

export async function paintedColor(surface: Locator, hex: string, opacity = 1) {
  return surface.evaluate(
    (element, { color, opacity }) => {
      const canvas = element as HTMLCanvasElement;
      if (!canvas.width || !canvas.height) return null;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      const rgb = Number.parseInt(color.slice(1), 16);
      const alpha = Math.round(opacity * 255);
      // Reading translucent pixels can round channels during premultiplication.
      const channelTolerance = opacity === 1 ? 0 : 4;
      let count = 0;
      let sumX = 0;
      let sumY = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (Math.abs(pixels[index + 3] - alpha) > 5) continue;
        if (
          Math.abs(pixels[index] - (rgb >> 16)) > channelTolerance ||
          Math.abs(pixels[index + 1] - ((rgb >> 8) & 255)) > channelTolerance ||
          Math.abs(pixels[index + 2] - (rgb & 255)) > channelTolerance
        )
          continue;
        const pixel = index / 4;
        sumX += pixel % canvas.width;
        sumY += Math.floor(pixel / canvas.width);
        count++;
      }
      if (!count) return null;
      const box = canvas.getBoundingClientRect();
      return {
        x: box.left + ((sumX / count) * box.width) / canvas.width,
        y: box.top + ((sumY / count) * box.height) / canvas.height,
        count,
      };
    },
    { color: hex, opacity }
  );
}

export async function locateNode(page: Page, node: { color: string }) {
  const surface = graphCanvas(page);
  let pixel: Awaited<ReturnType<typeof paintedColor>>;
  await expect
    .poll(
      async () => {
        pixel = await paintedColor(surface, node.color);
        return pixel?.count ?? 0;
      },
      { timeout: 10000 }
    )
    .toBeGreaterThan(6);
  return pixel!;
}

export async function clickNode(
  page: Page,
  node: { color: string; properties: { name: string } },
  button: 'left' | 'right' = 'left'
) {
  const tooltip = page.getByText(JSON.stringify(node.properties.name), { exact: true });
  let target!: { x: number; y: number };
  // The hit-testing canvas can lag behind the visible one during auto-fit.
  await expect(async () => {
    await page.mouse.move(0, 0);
    target = await locateNode(page, node);
    await page.mouse.move(target.x, target.y);
    await expect(tooltip).toBeVisible({ timeout: 750 });
  }).toPass({ timeout: 10000 });
  await page.mouse.click(target.x, target.y, { button });
}

export async function saveGraph(page: Page, id: string) {
  const [saved] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname === '/api-studio/explorer/snapshots/' + id
    ),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);
  expect(await saved.json()).toMatchObject({ code: 0 });
  await expect(page.getByText('Save Success', { exact: true })).toBeVisible();
}
