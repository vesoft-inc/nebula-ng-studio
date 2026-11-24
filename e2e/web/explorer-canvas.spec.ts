import { readFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { test } from '../support/web';
import { failure, table } from '../support/http';
import {
  acme,
  alex,
  asNode,
  clickNode,
  edgeColor,
  edgeId,
  graphCanvas,
  locateNode,
  neha,
  paintedColor,
  saveGraph,
  seedGraph,
  selected,
  selectedEntities,
  serveGraph,
  snapshots,
  worksAt,
} from '../support/explorer';

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

test('hits drawn nodes and edges, supports modifier selection and brackets a group with a pointer drag', async ({
  page,
  api,
}) => {
  serveGraph(api);
  await page.goto(seedGraph(api, 'selection'));
  await expect(page.getByRole('button', { name: 'edit-mode' })).toBeEnabled();
  const point = await locateNode(page, alex);
  await page.mouse.move(point.x, point.y);
  await expect(page.getByText('"Alex"', { exact: true })).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(selected(page, 1, 0)).toBeVisible();
  await page.mouse.move(0, 0);
  await page.keyboard.down('Shift');
  try {
    await clickNode(page, neha);
  } finally {
    await page.keyboard.up('Shift');
  }
  await expect(selected(page, 2, 0)).toBeVisible();
  const surface = graphCanvas(page);
  await surface.click({ position: { x: 60, y: 63 } });
  await expect(selectedEntities(page)).toHaveCount(0);

  const a = await locateNode(page, alex);
  const c = await locateNode(page, acme);
  await page.mouse.click((a.x + c.x) / 2 - 22, (a.y + c.y) / 2);
  await expect(selected(page, 0, 1)).toBeVisible();
  await surface.click({ position: { x: 60, y: 63 } });
  const b = await locateNode(page, neha);
  await page.keyboard.down('Shift');
  try {
    await drag(page, { x: a.x - 22, y: a.y - 24 }, { x: b.x + 22, y: b.y + 24 });
  } finally {
    await page.keyboard.up('Shift');
  }
  await expect(selected(page, 2, 0)).toBeVisible();

  await surface.click({ position: { x: 60, y: 63 } });
  await clickNode(page, alex, 'right');
  await page.getByRole('menuitem', { name: 'Invert Selection' }).click();
  await expect(selected(page, 2, 0)).toBeVisible();
  await selected(page, 2, 0).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export as CSV', exact: true }).click(),
  ]);
  const csv = (await readFile(await download.path())).toString();
  expect(csv).toContain('Neha');
  expect(csv).toContain('Acme');
  expect(csv).not.toContain('Alex');
  await page.keyboard.press('Escape');
  await saveGraph(page, 'selection');
  expect(JSON.parse(api.snapshots.get('selection')!.data).nodesSelected.sort()).toEqual(['12', '13']);
});

test('moves selected nodes together and restores local deletions through keyboard history', async ({ page, api }) => {
  serveGraph(api);
  await page.goto(seedGraph(api, 'history'));
  await clickNode(page, alex);
  await expect(selected(page, 1, 0)).toBeVisible();
  await page.keyboard.press('ControlOrMeta+a');
  await expect(selected(page, 3, 0)).toBeVisible();
  const before = await locateNode(page, alex);
  const neighborBefore = await locateNode(page, acme);
  await drag(page, before, { x: before.x + 40, y: before.y + 50 });
  await page.mouse.move(0, 0);
  const after = await locateNode(page, alex);
  const neighborAfter = await locateNode(page, acme);
  expect(after.y).toBeGreaterThan(before.y + 28);
  expect(neighborAfter.y).toBeGreaterThan(neighborBefore.y + 28);
  await graphCanvas(page).click({ position: { x: 60, y: 63 } });
  await expect(selectedEntities(page)).toHaveCount(0);
  await clickNode(page, alex);
  await expect(selected(page, 1, 0)).toBeVisible();
  await page.keyboard.press('Backspace');
  await page.mouse.move(0, 0);
  await expect.poll(() => paintedColor(graphCanvas(page), alex.color)).toBeNull();
  await page.keyboard.press('ControlOrMeta+z');
  await locateNode(page, alex);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(() => paintedColor(graphCanvas(page), alex.color)).toBeNull();
  await saveGraph(page, 'history');
  const saved = JSON.parse(api.snapshots.get('history')!.data);
  expect(saved.nodes.sort()).toEqual(['12', '13']);
  expect(saved.links).toEqual([]);
  await page.reload();
  await locateNode(page, neha);
  await expect.poll(() => paintedColor(graphCanvas(page), alex.color)).toBeNull();
});

test('zooms, pans the current snapshot from its minimap and toggles fullscreen', async ({ page, api }) => {
  serveGraph(api);
  const first = seedGraph(api, 'first');
  const second = seedGraph(api, 'second', { edge: false });
  await page.goto(first);
  const minimap = page.getByRole('button', { name: 'Minimap', exact: true });
  const viewport = page.getByRole('group', { name: 'Minimap viewport' });
  const zoomIn = page.getByRole('button', { name: 'Zoom In', exact: true });
  const fullscreen = page.getByRole('button', { name: 'Fullscreen', exact: true });
  await minimap.click();
  await expect(viewport).toBeVisible();
  await page.getByRole('button', { name: 'back', exact: true }).click();
  await expect(page).toHaveURL(snapshots);
  await page.getByRole('button', { name: 'Canvas second', exact: true }).click();
  await expect(page).toHaveURL(second);
  await minimap.click();
  const before = await locateNode(page, alex);
  await zoomIn.click();
  await expect.poll(async () => (await locateNode(page, alex)).count).toBeGreaterThan(before.count);
  const zoomed = await locateNode(page, alex);
  const box = (await viewport.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await drag(page, start, { x: start.x - 17, y: start.y + 8 });
  await expect.poll(async () => Math.abs((await locateNode(page, alex)).x - zoomed.x)).toBeGreaterThan(12);
  await fullscreen.click();
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await graphCanvas(page).boundingBox())!.width).toBe(1480);
  await fullscreen.click();
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');
  const scale = (await locateNode(page, alex)).count;
  await page.getByRole('button', { name: 'Zoom Out', exact: true }).click();
  await expect.poll(async () => (await locateNode(page, alex)).count).toBeLessThan(scale);
  const surface = graphCanvas(page);
  const { x, y } = (await surface.boundingBox())!;
  const beforePan = await locateNode(page, alex);
  await drag(page, { x: x + 110, y: y + 115 }, { x: x + 155, y: y + 150 });
  await expect.poll(async () => (await locateNode(page, alex)).x).toBeGreaterThan(beforePan.x + 25);
});

test('exports the graph as JSON, CSV and a valid PNG download', async ({ page, api }) => {
  serveGraph(api);
  await page.goto(seedGraph(api, 'exports'));
  await locateNode(page, acme);
  async function download(format: string) {
    await page.getByRole('button', { name: 'Export', exact: true }).hover();
    const menu = page.getByRole('menu');
    const [result] = await Promise.all([
      page.waitForEvent('download'),
      menu.getByRole('menuitem', { name: 'Export as ' + format, exact: true }).click(),
    ]);
    await page.mouse.move(0, 0);
    await expect(menu).toBeHidden();
    expect(result.suggestedFilename()).toMatch(new RegExp('\\.' + format.toLowerCase() + '$'));
    return readFile(await result.path());
  }
  const json = (await download('JSON')).toString().replace(/^\uFEFF/, '');
  const data = JSON.parse(json);
  expect(data.nodes.sort()).toEqual(['11', '12', '13']);
  expect(data.links).toHaveLength(1);
  const csv = (await download('CSV')).toString();
  expect(csv).toContain('Alex');
  expect(csv).toContain('WorksAt');
  const png = await download('PNG');
  const colors = [alex.color, acme.color, edgeColor];
  const painted = await page.evaluate(
    async ({ png, colors }) => {
      const response = await fetch('data:image/png;base64,' + png);
      const image = await createImageBitmap(await response.blob());
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      image.close();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const wanted = new Set(colors.map((color) => Number.parseInt(color.slice(1), 16)));
      const seen = new Set<number>();
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 250) continue;
        const rgb = (pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2];
        if (wanted.has(rgb)) seen.add(rgb);
      }
      return colors.filter((color) => seen.has(Number.parseInt(color.slice(1), 16)));
    },
    { png: png.toString('base64'), colors }
  );
  expect(painted, 'export contains both connected nodes and their edge').toEqual(colors);
});

test('an empty canvas retries a sample query and finds neighbors from its node context menu', async ({ page, api }) => {
  let samples = 0;
  let expansions = 0;
  serveGraph(api, (gql) => {
    if (gql.includes('match (v) limit 10 return v')) {
      expect(gql).toContain('USE `people-demo`');
      return ++samples === 1 ? failure('Sample query rejected') : table([{ v: asNode(alex) }]);
    }
    if (gql.includes('PARAMETERS $ids= LIST[')) {
      expect(gql).toContain('PARAMETERS $ids= LIST[11]');
      expect(gql).toContain('{1}(v1)');
      expansions++;
      return table([
        { p: { type: 'PATH', raw: 'Alex -> Acme', value: [asNode(alex).value, worksAt, asNode(acme).value] } },
      ]);
    }
    return undefined;
  });
  const url = seedGraph(api, 'empty');
  api.snapshots.get('empty')!.data = '';
  await page.goto(url);
  const sample = page.getByRole('button', { name: 'Show me a subgraph' });
  await sample.click();
  await expect(page.getByText('Sample query rejected', { exact: true })).toBeVisible();
  await sample.click();
  await expect(sample).toBeHidden();
  expect(samples).toBe(2);

  await page.getByRole('button', { name: 'Search in Exploration' }).click();
  await page.getByRole('combobox', { name: 'Search in Exploration' }).fill('Alex');
  await page.getByRole('option').filter({ hasText: 'Alex' }).click();
  await expect(selected(page, 1, 0)).toBeVisible();
  const surface = (await graphCanvas(page).boundingBox())!;
  await page.mouse.click(surface.x + surface.width / 2, surface.y + surface.height / 2, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Find Neighbors', exact: true }).click();
  await expect(selected(page, 2, 1)).toBeVisible();
  expect(expansions).toBe(1);
  await saveGraph(page, 'empty');
  expect(JSON.parse(api.snapshots.get('empty')!.data)).toMatchObject({
    nodes: expect.arrayContaining(['11', '13']),
    links: [edgeId],
  });
});
