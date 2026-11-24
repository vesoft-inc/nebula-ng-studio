import { expect } from '@playwright/test';
import { test } from '../support/web';
import { failure, table } from '../support/http';
import {
  acme,
  alex,
  asNode,
  clickNode,
  edgeId,
  graphCanvas,
  locateNode,
  saveGraph,
  seedGraph,
  selected,
  selectedEntities,
  serveGraph,
  worksAt,
} from '../support/explorer';

test('a node edit validates and retries, reads the saved node, then updates it without changing its key', async ({
  page,
  api,
}) => {
  const robin = { id: 14, type: 'Person', properties: { name: 'Robin', age: 32 } };
  let attempts = 0;
  let updates = 0;
  serveGraph(api, (gql) => {
    if (gql.includes(' INSERT ')) {
      expect(gql).toContain('INSERT (@`Person`{`name`: "Robin", `age`: 32})');
      return ++attempts === 1 ? failure('Insert rejected') : table([]);
    }
    if (gql.includes(' RETURN v') && gql.includes('"Robin"')) return table([{ v: asNode(robin) }]);
    if (gql.includes(' SET ')) {
      expect(gql).toContain('element_id(v) = 14) SET v.`age` = 33');
      expect(gql).not.toContain('SET v.`name`');
      updates++;
      return table([]);
    }
    return undefined;
  });
  await page.goto(seedGraph(api, 'node-edit'));
  await page.getByRole('button', { name: 'edit-mode' }).click();
  await page.getByRole('button', { name: 'Add Node', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Confirm', exact: true });
  await dialog.getByRole('textbox', { name: /name/i }).fill('Robin');
  const age = dialog.getByRole('textbox', { name: /age/i });
  await age.fill('invalid');
  await confirm.click();
  await expect(dialog.getByText(/valid integer/i)).toBeVisible();
  expect(attempts).toBe(0);
  await age.fill('32');
  await confirm.click();
  await expect(page.getByText('Insert rejected')).toBeVisible();
  await expect(age).toHaveValue('32');
  await confirm.click();
  await expect(dialog).toBeHidden();
  expect(attempts).toBe(2);

  await page.getByRole('button', { name: 'Search in Exploration' }).click();
  await page.getByRole('combobox', { name: 'Search in Exploration' }).fill('Robin');
  await page.getByRole('option').filter({ hasText: 'Robin' }).click();
  const box = (await graphCanvas(page).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Edit Properties' }).click();
  await expect(dialog.getByRole('textbox', { name: /name/i })).toBeDisabled();
  await expect(age).toHaveValue('32');
  await age.fill('33');
  await confirm.click();
  await expect(dialog).toBeHidden();
  expect(updates).toBe(1);
  await saveGraph(page, 'node-edit');
  expect(JSON.parse(api.snapshots.get('node-edit')!.data).nowDataMap['14'].data.value.properties).toEqual({
    name: 'Robin',
    age: 33,
  });
});

test('reverses endpoints for an eligible edge and distinguishes cancel from confirmed database deletion', async ({
  page,
  api,
}) => {
  let inserts = 0;
  let deletes = 0;
  serveGraph(api, (gql) => {
    if (gql.includes(' INSERT ')) {
      inserts++;
      expect(gql).toContain('(a@`Person` where element_id(a) = 11), (b@`Company` where element_id(b) = 13)');
      expect(gql).toContain('INSERT (a)-[@`WorksAt`{`since`: 2021}]->(b)');
      return table([]);
    }
    if (gql.includes('RETURN a, e, b')) {
      return table([{ a: asNode(alex), e: { type: 'EDGE', raw: 'edge', value: worksAt }, b: asNode(acme) }]);
    }
    if (gql.includes('DETACH DELETE')) {
      deletes++;
      expect(gql).toContain('element_id(v) = 11');
      return table([]);
    }
    return undefined;
  });
  await page.goto(seedGraph(api, 'edge-edit', { edge: false }));
  await page.getByRole('button', { name: 'edit-mode' }).click();
  const addEdge = page.getByRole('button', { name: 'Add Edge', exact: true });
  await addEdge.click();
  await expect(page.getByText(/Select exactly two nodes/)).toBeVisible();
  await clickNode(page, acme);
  await expect(selected(page, 1, 0)).toBeVisible();
  await page.mouse.move(0, 0);
  await page.keyboard.down('Shift');
  try {
    await clickNode(page, alex);
  } finally {
    await page.keyboard.up('Shift');
  }
  await expect(selected(page, 2, 0)).toBeVisible();
  await addEdge.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/edge direction is reversed/)).toBeVisible();
  await dialog.getByRole('textbox', { name: /since/i }).fill('2021');
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(inserts).toBe(1);

  await locateNode(page, alex);
  await graphCanvas(page).click({ position: { x: 100, y: 120 } });
  await expect(selectedEntities(page)).toHaveCount(0);
  await clickNode(page, alex);
  await expect(selected(page, 1, 0)).toBeVisible();
  await page.keyboard.press('Backspace');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(deletes).toBe(0);
  await graphCanvas(page).locator('../..').focus();
  await page.keyboard.press('Backspace');
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(deletes).toBe(1);
  await saveGraph(page, 'edge-edit');
  const saved = JSON.parse(api.snapshots.get('edge-edit')!.data);
  expect(saved.links).toEqual([]);
  expect(saved.nodes.sort()).toEqual(['12', '13']);
  await page.reload();
  await locateNode(page, acme);
  await expect(page.getByRole('button', { name: 'Add Node', exact: true })).toHaveCount(0);
});

test('editing and deleting an edge on the canvas preserves both vertices', async ({ page, api }) => {
  let update = '';
  let deleted = '';
  serveGraph(api, (gql) => {
    if (gql.includes(' SET e.')) {
      update = gql;
      return table([]);
    }
    if (gql.endsWith(' DELETE e')) {
      deleted = gql;
      return table([]);
    }
    return undefined;
  });
  await page.goto(seedGraph(api, 'edge-update'));
  await page.getByRole('button', { name: 'edit-mode' }).click();
  async function rightClickEdge() {
    await graphCanvas(page).click({ position: { x: 100, y: 120 } });
    await expect(selectedEntities(page)).toHaveCount(0);
    await expect(async () => {
      await page.mouse.move(0, 0);
      const a = await locateNode(page, alex);
      const c = await locateNode(page, acme);
      const x = Math.round((a.x + c.x) / 2) - 22;
      const y = Math.round((a.y + c.y) / 2);
      await page.mouse.move(x, y);
      await expect(page.getByText('since:', { exact: true })).toBeVisible({ timeout: 750 });
      await page.mouse.click(x, y, { button: 'right' });
      await expect(selected(page, 0, 1)).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 7000 });
  }
  const dialog = page.getByRole('dialog');
  await rightClickEdge();
  await page.getByRole('menuitem', { name: 'Edit Properties' }).click();
  const since = dialog.getByRole('textbox', { name: /since/i });
  await expect(since).toHaveValue('2021');
  await since.fill('2025');
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(dialog).toBeHidden();
  const match = '(a@`Person` where element_id(a) = 11)-[e@`WorksAt`]->(b@`Company` where element_id(b) = 13)';
  expect(update).toContain(match + ' SET e.`since` = 2025');
  await saveGraph(page, 'edge-update');
  await page.reload();
  await page.getByRole('button', { name: 'edit-mode' }).click();
  await rightClickEdge();
  await page.getByRole('menuitem', { name: 'Edit Properties' }).click();
  await expect(since).toHaveValue('2025');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await rightClickEdge();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(deleted).toContain(match + ' DELETE e');
  await saveGraph(page, 'edge-update');
  const saved = JSON.parse(api.snapshots.get('edge-update')!.data);
  expect(saved.links).toEqual([]);
  expect(saved.nowDataMap[edgeId]).toBeUndefined();
  expect(saved.nodes.sort()).toEqual(['11', '12', '13']);
});
