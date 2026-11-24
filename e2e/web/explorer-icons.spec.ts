import { expect } from '@playwright/test';
import { alex, locateNode, saveGraph, seedGraph, serveGraph } from '../support/explorer';
import { ok } from '../support/http';
import { test } from '../support/web';

test('uploads an icon, applies it to the canvas, and keeps it in the saved snapshot after catalog cleanup', async ({
  page,
  api,
}) => {
  const id = 'markers';
  const iconId = 'square';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" fill="#fec091"/></svg>';
  const groups = new Map<string, { id: string; name: string; type: string }>();
  const icons = new Map<string, { id: string; name: string; groupId: string; icon: string }>();
  serveGraph(api);
  const graphReply = api.override;
  api.override = async (path, request) => {
    const method = request.method();
    if (path === '/explorer/icongroup' && method === 'GET') {
      const type = new URL(request.url()).searchParams.get('type');
      return ok({ items: [...groups.values()].filter((group) => group.type === type) });
    }
    if (path === '/explorer/icongroup/add' && method === 'POST') {
      expect(request.postDataJSON()).toEqual({ name: 'new_group', type: 'svg' });
      groups.set(id, { id, ...request.postDataJSON() });
      return ok({ id });
    }
    const group = '/explorer/icongroup/' + id;
    if (path === group + '/icons' && method === 'GET') return ok({ items: [...icons.values()] });
    if (path === group && method === 'PUT') {
      expect(request.postDataJSON()).toEqual({ name: 'MapMarkers' });
      groups.get(id)!.name = 'MapMarkers';
      return ok({ id });
    }
    if (path === group && method === 'POST') {
      expect(request.postDataJSON()).toEqual({ name: 'square.svg', icon: svg });
      icons.set(iconId, { id: iconId, groupId: id, ...request.postDataJSON() });
      return ok({ id: iconId });
    }
    if (path === group + '/icon/' + iconId && method === 'DELETE') {
      icons.delete(iconId);
      return ok({ id: iconId });
    }
    if (path === group && method === 'DELETE') {
      groups.delete(id);
      return ok({ id });
    }
    return graphReply?.(path, request);
  };

  await page.goto(seedGraph(api, 'icon'));
  await locateNode(page, alex);
  await page.getByRole('button', { name: 'Graph Types Panel' }).click();
  await page.getByTitle('Person', { exact: true }).locator('..').locator('.color-picker-item').click();
  await page.getByRole('button', { name: 'Icon', exact: true }).click();
  await page.getByRole('button', { name: 'Group', exact: true }).click();
  const groupTab = page.getByRole('tab', { name: 'new_group' });
  await groupTab.getByText('new_group', { exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const groupName = page.getByRole('tab').getByRole('textbox');
  await groupName.fill('MapMarkers');
  await groupName.press('Tab');
  const renamed = page.getByRole('tab', { name: 'MapMarkers' });
  await expect(renamed).toBeVisible();
  const panel = page.getByRole('tabpanel', { name: 'MapMarkers' });
  const upload = panel.locator('input[type="file"]');
  await upload.setInputFiles({ name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByText('Failed to parse svg file', { exact: true })).toBeVisible();
  expect(icons.size).toBe(0);
  await upload.setInputFiles({ name: 'square.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  const square = panel.locator('rect[fill="#fec091"]');
  await square.click();
  await locateNode(page, { color: '#fec091' });
  await square.hover();
  await panel.locator('.deleteIcon').click();
  await expect(square).toHaveCount(0);
  expect(icons.size).toBe(0);
  await renamed.getByText('MapMarkers', { exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await expect(renamed).toHaveCount(0);
  expect(groups.size).toBe(0);
  await page.keyboard.press('Escape');

  await saveGraph(page, 'icon');
  const saved = JSON.parse(api.snapshots.get('icon')!.data);
  expect(saved.nowDataMap[alex.id].iconText).toBe('markers_square_square.svg');
  expect(saved.imagesCache).toEqual(
    expect.arrayContaining([['markers_square_square.svg', expect.stringContaining('data:image/svg+xml')]])
  );
  await page.reload();
  await locateNode(page, { color: '#fec091' });
});
