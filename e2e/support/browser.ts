import { expect, type Page } from '@playwright/test';

export async function enterQuery(page: Page, query: string) {
  const editor = page.locator('.monaco-editor:not(.readonly)').first();
  await expect(runButton(page)).toBeEnabled();
  await editor.getByRole('textbox').focus();
  await page.keyboard.press('ControlOrMeta+a');
  if (query.includes('"""')) {
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
    await page.evaluate((text) => navigator.clipboard.writeText(text), query);
    await page.keyboard.press('ControlOrMeta+v');
  } else await page.keyboard.insertText(query);
  await expect(editor.locator('.view-lines')).toHaveText(query.replaceAll(/\s+/g, ' '), { useInnerText: true });
}
export const runButton = (page: Page) => page.getByRole('button', { name: 'Run', exact: true });
export async function runQuery(page: Page, query: string) {
  await enterQuery(page, query);
  await runButton(page).click();
}
export async function signIn(page: Page, username: string, password: string, address?: string, port?: string) {
  if (address) await page.locator('input[name=address]').fill(address);
  if (port) await page.locator('input[name=port]').fill(port);
  await page.locator('input[name=username]').fill(username);
  await page.locator('input[name=password]').fill(password);
  await page.locator('button[type=submit]').click();
}
export async function disconnect(page: Page, username: string) {
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: /disconnect|log ?out|clear connection/i }).click();
}
export async function readResult(page: Page, value: string) {
  await expect(
    page
      .getByText(value, { exact: true })
      .or(page.getByRole('cell', { name: JSON.stringify(value), exact: true }))
      .first()
  ).toBeVisible();
}
export function gate() {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { pending, release };
}
