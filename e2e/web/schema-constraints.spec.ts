import { expect, type Page } from '@playwright/test';
import { test, type StudioApi } from '../support/web';
import { graphTypes, openTypeOnCanvas, schemaCanvas } from '../support/schema';

function seedSketch(api: StudioApi) {
  api.sketch = {
    id: 1,
    name: 'ConstraintMatrix',
    snapshot: '',
    schema: JSON.stringify({
      nodes: [
        {
          name: 'Person',
          style: { position: { x: 150, y: 150 } },
          properties: [
            { name: 'id', type: 'STRING', isPrimaryKey: true, nullable: false },
            { name: 'tenant', type: 'UINT32', nullable: false },
            { name: 'tags', type: 'LIST', itemType: 'STRING' },
          ],
        },
        {
          name: 'Company',
          style: { position: { x: 550, y: 200 } },
          properties: [{ name: 'id', type: 'STRING', isPrimaryKey: true }],
        },
      ],
      edges: [
        {
          name: 'WorksAt',
          srcNode: { name: 'Person' },
          dstNode: { name: 'Company' },
          properties: [{ name: 'seq', type: 'INT32', nullable: false }],
        },
      ],
    }),
  };
}

async function clearCanvasSelection(page: Page) {
  await schemaCanvas(page)
    .locator('.react-flow__pane')
    .click({ position: { x: 105, y: 120 } });
}
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const ddl = (page: Page) => page.locator('.monaco-editor .view-lines');

for (const direction of [
  { label: 'Person -> Company', left: '-', right: '->' },
  { label: 'Person <- Company', left: '<-', right: '-' },
  { label: 'Person - Company', left: '~', right: '~' },
]) {
  test('combines edge direction and multi-edge key mode · ' + direction.label, async ({ page, api }) => {
    test.setTimeout(60000);
    seedSketch(api);
    await page.goto(graphTypes + '/sketch/1');
    for (const key of [
      { mode: 'None', clause: '' },
      { mode: 'Auto', clause: ',MULTIEDGE KEY()' },
      { mode: 'Customize', clause: ',MULTIEDGE KEY(`seq`)' },
    ]) {
      await openTypeOnCanvas(page, 'edge');
      await page.getByRole('combobox', { name: 'Direction' }).click();
      await page.getByRole('option', { name: direction.label, exact: true }).click();
      await page.getByRole('combobox', { name: 'Multi Edge Key Mode' }).click();
      await page.getByRole('option', { name: key.mode, exact: true }).click();
      const keyField = page.getByRole('checkbox', { name: 'Multi Edge Key', exact: true });
      if (key.mode === 'Customize') await keyField.check();
      else await expect(keyField).toHaveCount(0);
      await next(page).click();
      const pattern =
        'EDGE `WorksAt` (`Person`)' +
        direction.left +
        '[ {`seq` INT32 NOT NULL' +
        key.clause +
        '}]' +
        direction.right +
        '(`Company`)';
      await expect(ddl(page)).toContainText(pattern);
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await clearCanvasSelection(page);
    }
  });
}

test('a composite key excludes unsupported, nullable and defaulted properties before generating DDL', async ({
  page,
  api,
}) => {
  seedSketch(api);
  await page.goto(graphTypes + '/sketch/1');
  await openTypeOnCanvas(page, 'node');
  await page.getByRole('checkbox', { name: 'Primary Key: tenant' }).check();
  const tags = page.getByRole('checkbox', { name: 'Primary Key: tags' });
  await tags.check();
  await next(page).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'uses LIST, which is not supported for primary keys' })
  ).toBeVisible();
  await expect(ddl(page)).toHaveCount(0);
  await tags.uncheck();

  const settings = page.getByRole('button', { name: 'More settings: tenant' });
  await settings.click();
  await page.locator('input[name="properties.1.nullable"]').check();
  await page.keyboard.press('Escape');
  await next(page).click();
  await expect(page.getByText(/Primary key property "tenant" cannot allow null values/)).toBeVisible();
  await expect(ddl(page)).toHaveCount(0);
  await settings.click();
  await page.locator('input[name="properties.1.nullable"]').uncheck();
  await page.locator('input[aria-label="Default Value"]').fill('4');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await next(page).click();
  await expect(page.getByText(/Primary key property "tenant" cannot have a default value/)).toBeVisible();
  await expect(ddl(page)).toHaveCount(0);
  await settings.click();
  await page.locator('input[aria-label="Default Value"]').fill('');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await next(page).click();
  await expect(ddl(page)).toContainText('PRIMARY KEY(`id`,`tenant`)');
  await expect(ddl(page)).toContainText('`tags` LIST<STRING>');
});

test('an invalid DECIMAL in the edge blocks a valid node and changing type clears stale parameters', async ({
  page,
  api,
}) => {
  seedSketch(api);
  await page.goto(graphTypes + '/sketch/1');
  await openTypeOnCanvas(page, 'edge');
  const type = page.getByRole('combobox', { name: 'Prop Type', exact: true });
  await type.fill('DECIMAL');
  await page.getByRole('option', { name: 'DECIMAL', exact: true }).click();
  await page.getByRole('button', { name: 'More settings: seq' }).click();
  await page.locator('input[name$=".decimalPrecision"]').fill('4');
  await page.locator('input[name$=".decimalScale"]').fill('5');
  await page.keyboard.press('Escape');
  await next(page).click();
  await expect(page.getByText('seq: check DECIMAL precision and scale.', { exact: true })).toBeVisible();
  await expect(ddl(page)).toHaveCount(0);
  await type.fill('INT32');
  await page.getByRole('option', { name: 'INT32', exact: true }).click();
  await next(page).click();
  await expect(ddl(page)).toContainText('`seq` INT32 NOT NULL');
  await expect(ddl(page)).not.toContainText('DECIMAL');
});
