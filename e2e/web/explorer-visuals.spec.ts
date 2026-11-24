import { expect } from '@playwright/test';
import { GraphLayoutType } from '../../packages/studio-ui-internal/src/graph/constants';
import {
  acme,
  alex,
  asNode,
  clickNode,
  edgeId,
  graphCanvas,
  locateNode,
  neha,
  paintedColor,
  saveGraph,
  seedGraph,
  selected,
  serveGraph,
} from '../support/explorer';
import { test } from '../support/web';
import { table } from '../support/http';

const layoutLabels: Record<GraphLayoutType, string> = {
  force: 'Force',
  dagre: 'Dagre',
  dagreLR: 'Dagre-LR',
  circular: 'Circular',
  grid: 'Grid',
  radial: 'Ridal',
  concentric: 'Concentric',
  neural: 'Neural Network',
};

type Point = { x: number; y: number };
type SavedPosition = Point & { fx?: number; fy?: number };
const distance = (from: Point, to: Point) => Math.hypot(from.x - to.x, from.y - to.y);
const connectedGraph = [alex, neha, acme] as const;

function assertLayout(layout: GraphLayoutType, [source, isolated, target]: SavedPosition[]) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const isolatedDx = isolated.x - source.x;
  const isolatedDy = isolated.y - source.y;
  const distances = [distance(source, target), distance(source, isolated), distance(target, isolated)];
  expect(Math.min(...distances)).toBeGreaterThan(10);

  switch (layout) {
    case GraphLayoutType.Force:
      // The simulation leaves the vertices unpinned. Fixed layouts persist fx/fy.
      for (const point of [source, isolated, target]) {
        expect(point.fx).toBeUndefined();
        expect(point.fy).toBeUndefined();
      }
      break;
    case GraphLayoutType.Dagre:
      expect(dx).toBeCloseTo(0, 1);
      expect(dy).toBeGreaterThan(10);
      expect(isolatedDx).toBeGreaterThan(10);
      expect(isolatedDy).toBeCloseTo(0, 1);
      break;
    case GraphLayoutType.DagreLR:
      expect(dy).toBeCloseTo(0, 1);
      expect(isolatedDx).toBeCloseTo(0, 1);
      expect(isolatedDy).toBeGreaterThan(10);
      expect(dx / isolatedDy).toBeGreaterThan(1.4);
      break;
    case GraphLayoutType.Circular:
      expect(Math.max(...distances) / Math.min(...distances)).toBeLessThan(1.05);
      break;
    case GraphLayoutType.Grid:
      expect(dy).toBeCloseTo(0, 1);
      expect(isolatedDx).toBeCloseTo(0, 1);
      expect(dx).toBeGreaterThan(10);
      expect(dx / isolatedDy).toBeCloseTo(1, 1);
      break;
    case GraphLayoutType.Radial:
      expect(distances[0] / distances[2]).toBeCloseTo(1, 1);
      expect((distances[0] + distances[2]) / distances[1]).toBeCloseTo(1, 1);
      break;
    case GraphLayoutType.Concentric:
      expect(distances[0] / distances[1]).toBeCloseTo(1, 1);
      expect((distances[0] + distances[1]) / distances[2]).toBeCloseTo(1, 1);
      break;
    case GraphLayoutType.Neural:
      expect(isolatedDy).toBeCloseTo(0, 1);
      expect(isolatedDx).toBeGreaterThan(10);
      expect(dx / isolatedDx).toBeCloseTo(0.5, 1);
      expect(dy).toBeGreaterThan(10);
      break;
  }
}

function relativeOffsets([anchor, ...points]: Point[]) {
  const scale = Math.max(...points.map((point) => distance(point, anchor)));
  return points.flatMap(({ x, y }) => [(x - anchor.x) / scale, (y - anchor.y) / scale]);
}

for (const layout of Object.values(GraphLayoutType)) {
  const label = layoutLabels[layout];
  test('applies and persists the ' + label + ' graph layout', async ({ page, api }) => {
    if (layout === GraphLayoutType.Force) {
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        // Browsers can expose WebGLRenderingContext while context creation fails.
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
          value(this: HTMLCanvasElement, type: string, ...options: unknown[]) {
            if (type === 'webgl' || type === 'experimental-webgl') return null;
            return Reflect.apply(getContext, this, [type, ...options]);
          },
        });
      });
    }
    serveGraph(api);
    await page.goto(seedGraph(api, 'layout'));
    const before = await locateNode(page, alex);
    await page.getByRole('button', { name: 'Graph Layout' }).click();
    await page.getByText(label, { exact: true }).click();
    await expect(page.getByText(label, { exact: true })).toBeHidden();
    await expect
      .poll(async () => {
        const point = await paintedColor(graphCanvas(page), alex.color);
        return point ? Math.hypot(point.x - before.x, point.y - before.y) : 0;
      })
      .toBeGreaterThan(12);
    await saveGraph(page, 'layout');
    const saved = JSON.parse(api.snapshots.get('layout')!.data);
    expect(saved.nodes.sort()).toEqual(['11', '12', '13']);
    expect(saved.links).toEqual([edgeId]);
    const positions: SavedPosition[] = connectedGraph.map(({ id }) => saved.nowDataMap[id]);
    for (const { x, y } of positions) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
    expect(distance(positions[0], alex)).toBeGreaterThan(10);
    assertLayout(layout, positions);

    await page.reload();
    if (layout === GraphLayoutType.Force) {
      // Restored vertices can keep moving under the simulation.
      for (const node of connectedGraph) await locateNode(page, node);
    } else {
      const expected = relativeOffsets(positions);
      await expect
        .poll(
          async () => {
            const painted = await Promise.all(
              connectedGraph.map(({ color }) => paintedColor(graphCanvas(page), color))
            );
            if (!painted.every((point) => point && point.count > 6)) return Infinity;
            const offsets = relativeOffsets(painted as Point[]);
            return Math.max(...offsets.map((offset, index) => Math.abs(offset - expected[index])));
          },
          { message: 'Reload preserves the layout up to pan and zoom' }
        )
        .toBeLessThan(0.08);
    }
  });
}

test('an active filter follows display mode, refreshed query results and changed properties', async ({ page, api }) => {
  const youngerAlex = asNode({ ...alex, properties: { ...alex.properties, age: 24 } });
  const olderNeha = asNode({ ...neha, properties: { ...neha.properties, age: 36 } });
  const rory = asNode({ id: 14, type: 'Person', properties: { name: 'Rory', age: 20 } });
  serveGraph(api, (gql) => {
    if (gql.includes('LIST["Alex","Neha"]')) return table([{ v: youngerAlex }, { v: olderNeha }]);
    if (gql.includes('LIST["Rory"]')) return table([{ v: rory }]);
    if (gql.includes('element_id(v) = 12) SET v.`age` = 20')) return table([]);
    return undefined;
  });
  await page.goto(seedGraph(api, 'visibility'));
  const surface = graphCanvas(page);
  await locateNode(page, neha);
  const filter = page.getByRole('button', { name: 'Exploration Result Filter' });
  await filter.click();
  for (const [label, value] of [
    ['Node/Edge Type', 'Person'],
    ['Property', 'age'],
    ['Operator', '>='],
  ]) {
    await page.getByRole('combobox', { name: label }).click();
    await page.getByRole('option', { name: value, exact: label !== 'Property' }).click();
  }
  await page.getByRole('textbox', { name: 'Value', exact: true }).fill('30');
  await page.getByRole('radio', { name: 'Hide', exact: true }).click();
  const apply = page.getByRole('checkbox', { name: 'Apply', exact: true });
  await apply.press('Space');
  await expect(apply).toBeChecked();
  await expect.poll(() => paintedColor(surface, neha.color)).toBeNull();
  await expect.poll(() => paintedColor(surface, neha.color, 0.2)).toBeNull();
  await locateNode(page, alex);
  await locateNode(page, acme);
  await saveGraph(page, 'visibility');
  expect(JSON.parse(api.snapshots.get('visibility')!.data).nodes).toHaveLength(3);
  await page.reload();
  await locateNode(page, alex);
  await expect.poll(() => paintedColor(surface, neha.color)).toBeNull();
  await filter.click();
  await page.getByRole('radio', { name: 'Dismiss', exact: true }).press('Space');
  await expect(apply).toBeChecked();
  await expect.poll(() => paintedColor(surface, neha.color)).toBeNull();
  await expect
    .poll(async () => (await paintedColor(surface, neha.color, 0.2))?.count ?? 0, {
      message: 'Dismiss keeps the node visible with a translucent fill',
    })
    .toBeGreaterThan(6);
  await locateNode(page, alex);
  await page.getByRole('radio', { name: 'Hide', exact: true }).press('Space');
  await expect.poll(() => paintedColor(surface, neha.color, 0.2)).toBeNull();

  await page.getByRole('button', { name: 'Graph Query', exact: true }).click();
  await page.getByRole('button', { name: 'Query Node', exact: true }).click();
  await page.getByRole('combobox', { name: 'Node Type' }).click();
  await page.getByRole('option', { name: 'Person', exact: true }).click();
  await page.getByRole('combobox', { name: 'Property' }).click();
  await page.getByRole('option', { name: /^name/ }).click();
  const value = page.getByRole('textbox', { name: 'Value', exact: true });
  const query = page.getByRole('button', { name: 'Query', exact: true });
  await value.fill('Alex\nNeha');
  await query.click();
  await locateNode(page, neha);
  await expect.poll(() => paintedColor(surface, alex.color)).toBeNull();
  await expect(selected(page, 1, 0)).toBeVisible();

  await value.fill('Rory');
  await query.click();
  await saveGraph(page, 'visibility');
  const saved = JSON.parse(api.snapshots.get('visibility')!.data);
  expect(saved.nodes.sort()).toEqual(['11', '12', '13', '14']);
  // New Person nodes use the existing Person color. Both Alex and Rory are hidden.
  await expect.poll(() => paintedColor(surface, alex.color)).toBeNull();

  await page.getByRole('button', { name: 'edit-mode' }).click();
  await clickNode(page, neha, 'right');
  await page.getByRole('menuitem', { name: 'Edit Properties' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /age/i }).fill('20');
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => paintedColor(surface, neha.color)).toBeNull();
  await locateNode(page, acme);
  await filter.click();
  await apply.press('Space');
  await locateNode(page, alex);
  await locateNode(page, neha);
});

test('the type panel recolors nodes and edges independently and reads the styles back', async ({ page, api }) => {
  serveGraph(api);
  await page.goto(seedGraph(api, 'styles'));
  await locateNode(page, alex);
  const panel = page.getByRole('button', { name: 'Graph Types Panel' });
  await panel.click();
  await expect(panel).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('radio', { name: 'Node Type', exact: true }).click();
  await expect(page.getByTitle('WorksAt', { exact: true })).toHaveCount(0);
  const person = page.locator('nav').filter({ has: page.getByTitle('Person', { exact: true }) });
  await person.locator('.color-picker-item').first().click();
  await page.getByTitle('#8ACCFF', { exact: true }).click();
  await page.keyboard.press('Escape');
  await locateNode(page, { color: '#8accff' });
  await expect.poll(() => paintedColor(graphCanvas(page), alex.color)).toBeNull();
  await expect.poll(() => paintedColor(graphCanvas(page), neha.color)).toBeNull();
  await locateNode(page, acme);

  await page.getByRole('radio', { name: 'Edge Type', exact: true }).click();
  await expect(page.getByTitle('Person', { exact: true })).toHaveCount(0);
  await page.getByTitle('WorksAt', { exact: true }).locator('..').locator('svg').click();
  await page.getByTitle('#F1A829', { exact: true }).click();
  await page.keyboard.press('Escape');
  await graphCanvas(page).click({ position: { x: 60, y: 63 } });
  await expect.poll(() => paintedColor(graphCanvas(page), '#f1a829')).not.toBeNull();
  await saveGraph(page, 'styles');
  const data = JSON.parse(api.snapshots.get('styles')!.data).nowDataMap;
  expect(data[alex.id].color).toBe('#8accff');
  expect(data[neha.id].color).toBe('#8accff');
  expect(data[acme.id].color).toBe(acme.color);
  expect(data[edgeId].color).toBe('#f1a829');
  await page.reload();
  await locateNode(page, { color: '#8accff' });
  await expect.poll(() => paintedColor(graphCanvas(page), '#f1a829')).not.toBeNull();
});
