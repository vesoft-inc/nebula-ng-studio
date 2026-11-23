import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { signIn, runQuery, disconnect } from '../support/browser';
const env = process.env;
const web = env.STUDIO_INTEGRATION_BASE_URL;
const address = env.STUDIO_INTEGRATION_GRAPHD_ADDRESS;
const username = env.STUDIO_INTEGRATION_GRAPHD_USERNAME;
const password = env.STUDIO_INTEGRATION_GRAPHD_PASSWORD;
const gui = env.GUI_INTEGRATION_BASE_URL;
const guiUser = env.GUI_INTEGRATION_USERNAME;
const guiPassword = env.GUI_INTEGRATION_PASSWORD;
async function webLogin(page: Page, path: string) {
  const target = new URL(web!.replace(/\/$/, '') + path);
  const host = new URL('http://' + address);
  await page.goto(target.href);
  await signIn(page, username!, password!, host.hostname, host.port);
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
    const schema = env.STUDIO_INTEGRATION_WRITE_SCHEMA;
    const type = env.STUDIO_INTEGRATION_GRAPH_TYPE;
    test.skip(!(schema && type), 'Requires a dedicated writable test schema and an existing graph type');
    const name = 'studio_e2e_' + randomUUID().replaceAll('-', '');
    await webLogin(page, '/schema-list');
    await page.getByRole('button', { name: 'Path: ' + schema, exact: true }).click();
    await expect(page).toHaveURL(/schema-manager\/graphtype$/);
    await page.getByText('Graph', { exact: true }).first().click();
    const api = new URL('/api-studio/gql/exec', page.url()).href;
    const current = await page.request.post(api, { data: { gql: 'SHOW CURRENT_SCHEMA' } });
    expect((await current.json()).data.tables[0].path).toBe(schema);
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
      const cleanup = await page.request.post(api, { data: { gql: 'DROP GRAPH IF EXISTS `' + name + '`' } });
      expect((await cleanup.json()).code, 'cleanup of ' + name).toBe(0);
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
