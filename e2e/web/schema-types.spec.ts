import { expect, type Locator, type Page } from '@playwright/test';
import { PropertyDataType } from '../../packages/studio-core/src/contracts/constants';
import { graphTypes, identifier, openTypeOnCanvas, serveSchemaType } from '../support/schema';
import { table } from '../support/http';
import { test } from '../support/web';

type Field = {
  name: string;
  type: string;
  ddl: string;
  parameters?: Record<string, string>;
};

const scalar = (type: string): Field => ({
  name: 'p_' + type.toLowerCase().replaceAll(/[^a-z0-9]+/g, '_'),
  type,
  ddl: type,
});
const groups: Record<string, Field[]> = {
  'signed integers and string': ['STRING', 'INT8', 'INT16', 'INT32', 'INT64'].map(scalar),
  'unsigned integers and boolean': ['UINT8', 'UINT16', 'UINT32', 'UINT64', 'BOOL'].map(scalar),
  'floating point and date': ['FLOAT', 'FLOAT32', 'FLOAT64', 'DOUBLE', 'DATE'].map(scalar),
  'time and decimal': [
    ...['LOCAL TIME', 'ZONED TIME', 'LOCAL DATETIME', 'ZONED DATETIME'].map(scalar),
    { name: 'p_decimal', type: 'DECIMAL', ddl: 'DECIMAL(12, 0)', parameters: { Precision: '12', Scale: '0' } },
  ],
  'collections and vector': [
    { name: 'p_list', type: 'LIST', ddl: 'LIST<INT32>', parameters: { 'Item Type': 'INT32' } },
    { name: 'p_set', type: 'SET', ddl: 'SET<DATE>', parameters: { 'Item Type': 'DATE' } },
    {
      name: 'p_map',
      type: 'MAP',
      ddl: 'MAP<UINT16, BOOL>',
      parameters: { 'Key Type': 'UINT16', 'Value Type': 'BOOL' },
    },
    { name: 'p_vector', type: 'VECTOR', ddl: 'VECTOR<7, FLOAT>', parameters: { 'Dimension Count': '7' } },
  ],
  geography: ['GEOGRAPHY', 'GEOGRAPHY(Any)', 'GEOGRAPHY(Point)', 'GEOGRAPHY(LineString)', 'GEOGRAPHY(Polygon)'].map(
    scalar
  ),
};

async function pick(page: Page, field: Locator, option: string) {
  if ((await field.inputValue()) === option) return;
  await field.fill(option);
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function addProperty(page: Page, property: Field) {
  await page.getByRole('button', { name: 'Add Property', exact: true }).click();
  await page.getByRole('textbox', { name: 'Prop Name' }).last().fill(property.name);
  await pick(page, page.getByRole('combobox', { name: 'Prop Type' }).last(), property.type);
  const parameters = property.parameters ?? {};
  for (const [label, value] of Object.entries(parameters)) {
    if (label === 'Precision') {
      await page.getByRole('button', { name: 'More settings: ' + property.name }).click();
    }
    if (property.type === 'DECIMAL') {
      const fieldName = label === 'Precision' ? 'decimalPrecision' : 'decimalScale';
      await page.locator('input[name$=".' + fieldName + '"]').fill(value);
    } else if (label === 'Dimension Count') {
      await page.getByRole('spinbutton', { name: label, exact: true }).fill(value);
    } else {
      await pick(page, page.getByRole('combobox', { name: label, exact: true }).last(), value);
    }
  }
  if (property.type === 'DECIMAL') await page.keyboard.press('Escape');
}

test('the canvas property matrix covers the complete property type catalog', () => {
  expect(
    Object.values(groups)
      .flat()
      .map(({ type }) => type)
      .sort()
  ).toEqual(Object.values(PropertyDataType).sort());
});

for (const entity of ['node', 'edge'] as const) {
  for (const [family, properties] of Object.entries(groups)) {
    test(`${entity} properties round-trip through the canvas and DDL · ${family}`, async ({ page, api }) => {
      test.setTimeout(60000);
      const rows: Parameters<typeof serveSchemaType>[1] = { node: [identifier], edge: [] };
      const target = entity === 'node' ? 'NODE `Person`' : 'EDGE `WorksAt`';
      let submitted = '';
      serveSchemaType(api, rows, (gql) => {
        if (!gql.startsWith('ALTER GRAPH TYPE ')) return;
        expect(gql).toContain('ALTER ' + target + ' ADD PROPERTIES');
        for (const property of properties) {
          const segment = gql.match(new RegExp('`' + property.name + '` ([^}]*?)(?=,`|})'))?.[1];
          expect(segment).toBe(property.ddl);
          rows[entity].push({ property_name: property.name, data_type: segment!, nullable: true });
        }
        submitted = gql;
        return table([]);
      });

      const edit = graphTypes + '/edit/People';
      await page.goto(edit);
      await openTypeOnCanvas(page, entity);
      for (const property of properties) await addProperty(page, property);
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.locator('.monaco-editor .view-lines')).toContainText('ALTER ' + target + ' ADD PROPERTIES');
      await page.getByRole('button', { name: 'Commit Edit', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(graphTypes + '/?$'));
      expect(submitted).toBeTruthy();

      await page.goto(edit);
      await openTypeOnCanvas(page, entity);
      for (const [index, property] of properties.entries()) {
        const offset = index + (entity === 'node' ? 1 : 0);
        await expect(page.getByRole('textbox', { name: 'Prop Name' }).nth(offset)).toHaveValue(property.name);
        const restored = property.type === 'GEOGRAPHY(Any)' ? 'GEOGRAPHY' : property.type;
        await expect(page.getByRole('combobox', { name: 'Prop Type' }).nth(offset)).toHaveValue(restored);
      }
      const last = properties[properties.length - 1];
      if (last.type === 'DECIMAL') {
        await page.getByRole('button', { name: 'More settings: ' + last.name }).click();
        await expect(page.locator('input[name$=".decimalPrecision"]')).toHaveValue('12');
        await expect(page.locator('input[name$=".decimalScale"]')).toHaveValue('0');
      }
      if (last.type === 'VECTOR') {
        await expect(page.getByRole('spinbutton', { name: 'Dimension Count' })).toHaveValue('7');
        await expect(page.getByRole('combobox', { name: 'Item Type', exact: true }).nth(0)).toHaveValue('INT32');
        await expect(page.getByRole('combobox', { name: 'Item Type', exact: true }).nth(1)).toHaveValue('DATE');
        await expect(page.getByRole('combobox', { name: 'Key Type' })).toHaveValue('UINT16');
        await expect(page.getByRole('combobox', { name: 'Value Type' })).toHaveValue('BOOL');
      }
    });
  }
}
