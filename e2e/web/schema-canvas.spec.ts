import { expect, type Locator } from '@playwright/test';
import { test, type StudioApi } from '../support/web';
import { failure, table, type Reply } from '../support/http';
import {
  addCanvasNode,
  connectNodes,
  drag,
  graphTypes as typeList,
  identifier,
  openTypeOnCanvas,
  schemaCanvas as canvas,
  schemaNode as node,
  serveSchemaTypes,
} from '../support/schema';

const layoutKey = 'studio-schema-layout-v1|graphd:9669|alice|~2finitial|People';
const savedPositions = { Person: { x: 150, y: 150 }, Company: { x: 450, y: 180 } };

type EdgeFixture = { name: string; pattern: string; key?: string };

function serveGraphType(
  api: StudioApi,
  name: string,
  nodes: string[],
  edge?: EdgeFixture,
  write?: (gql: string) => Reply | undefined
) {
  api.override = async (path, request) => {
    if (path !== '/gql/exec' || request.method() !== 'POST') return;
    const { gql } = request.postDataJSON() as { gql: string };
    if (gql === 'CALL describe_graph_type("' + name + '") RETURN *') {
      const rows = nodes.map((type_name) => ({
        type_name,
        entity_type: 'Node',
        labels: [],
        properties: ['id'],
        'primary_key/multiedge_key': ['id'],
      }));
      return table(
        edge
          ? [
              ...rows,
              {
                type_name: edge.name,
                entity_type: 'Edge',
                labels: [],
                properties: edge.key ? [edge.key] : [],
                type_pattern: edge.pattern,
                'primary_key/multiedge_key': edge.key ? [edge.key] : 'Unique',
              },
            ]
          : rows
      );
    }
    if (gql.includes('CALL describe_node_type(gtn, type_name)') && gql.startsWith('LET gtn = "' + name + '"')) {
      return table(
        nodes.map((type_name) => ({
          type_name,
          property_name: 'id',
          data_type: 'STRING',
          primary_key: 'Y',
          nullable: false,
        }))
      );
    }
    if (
      edge?.key &&
      gql.includes('CALL describe_edge_type(gtn, type_name)') &&
      gql.startsWith('LET gtn = "' + name + '"')
    ) {
      return table([{ type_name: edge.name, property_name: edge.key, data_type: 'STRING', multi_edge_key: 'Y' }]);
    }
    return write?.(gql);
  };
}

function setSavedLayout(api: StudioApi, graphTypeName = 'People') {
  api.config.set(
    layoutKey.replace(/People$/, graphTypeName),
    JSON.stringify({
      version: 1,
      address: 'graphd:9669',
      username: 'alice',
      schemaPath: '/initial',
      graphTypeName,
      nodes: savedPositions,
    })
  );
}

async function position(entity: Locator) {
  return entity.evaluate((element) => {
    const transform = new DOMMatrix(getComputedStyle(element).transform);
    return { x: transform.e, y: transform.f };
  });
}

test('a GraphType created by dragging nodes and connecting handles survives a DDL round trip', async ({
  page,
  api,
}) => {
  const graphType = 'VisualPeople';
  const createdNodes: string[] = [];
  let createdEdge: EdgeFixture | undefined;
  let submitted = '';
  serveGraphType(api, graphType, createdNodes, undefined, (gql) => {
    if (!gql.startsWith('CREATE GRAPH TYPE ')) return;
    submitted = gql;
    createdNodes.push(...Array.from(gql.matchAll(/NODE `([^`]+)`/g), (match) => match[1]));
    const relationship = gql.match(
      /EDGE `([^`]+)` \(`([^`]+)`\)<-\[[^\]]*MULTIEDGE KEY\(`([^`]+)`\)\}\]-\(`([^`]+)`\)/
    );
    if (relationship) {
      const [, name, source, key, target] = relationship;
      createdEdge = { name, pattern: '(' + source + ')<-[' + name + ']-(' + target + ')', key };
    }
    api.types.push(graphType);
    return table([]);
  });

  await page.goto(typeList + '/create');
  await page.getByRole('textbox', { name: 'Graph Type Name' }).fill(graphType);
  await addCanvasNode(page, 'Person', 0.21);
  await page.getByRole('checkbox', { name: 'Primary Key: id' }).check();
  await canvas(page)
    .locator('.react-flow__pane')
    .click({ position: { x: 105, y: 120 } });
  await addCanvasNode(page, 'Company', 0.36);

  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.click();
  await expect(page.getByText('Select at least one primary key property.', { exact: true })).toBeVisible();
  expect(submitted).toBe('');
  await page.getByRole('checkbox', { name: 'Primary Key: id' }).check();
  await canvas(page)
    .locator('.react-flow__pane')
    .click({ position: { x: 105, y: 120 } });
  await expect(page.getByRole('textbox', { name: 'Node type name' })).toHaveCount(0);

  const source = node(page, 'Person').locator('.react-flow__handle.source[data-handlepos="right"]');
  const target = node(page, 'Company').locator('.react-flow__handle.target[data-handlepos="left"]');
  await connectNodes(page, source, target);
  await page.getByRole('textbox', { name: 'Edge Type Name' }).fill('WorksAt');
  await expect(canvas(page).getByText('WorksAt', { exact: true })).toBeVisible();
  const direction = page.getByRole('combobox', { name: 'Direction' });
  await expect(direction).toHaveText('Person -> Company');
  await direction.click();
  await page.getByRole('option', { name: 'Person <- Company', exact: true }).click();
  await expect(canvas(page).locator('.react-flow__edge-path')).toHaveAttribute('marker-start', 'url(#arrow-backward)');
  await page.getByRole('button', { name: 'Add Property', exact: true }).click();
  await page.getByRole('textbox', { name: 'Prop Name' }).fill('seq');
  await page.getByRole('combobox', { name: 'Multi Edge Key Mode' }).click();
  await page.getByRole('option', { name: 'Customize', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Multi Edge Key', exact: true }).check();

  await next.click();
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('WorksAt');
  await page.getByRole('button', { name: 'Create Graph Type', exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(typeList + '/?$'));
  expect(submitted).toContain('PRIMARY KEY(`id`)');
  expect(submitted).toContain('`seq` STRING');
  expect(createdNodes).toEqual(['Person', 'Company']);
  expect(createdEdge).toEqual({ name: 'WorksAt', pattern: '(Person)<-[WorksAt]-(Company)', key: 'seq' });
  serveGraphType(api, graphType, createdNodes, createdEdge);
  setSavedLayout(api, graphType);
  await page.getByText(graphType, { exact: true }).last().click();
  await expect(page).toHaveURL(typeList + '/view/' + graphType);
  await expect(node(page, 'Person')).toBeVisible();
  await expect(node(page, 'Company')).toBeVisible();
  await expect(canvas(page).getByText('WorksAt', { exact: true })).toBeVisible();
  await expect(canvas(page).locator('.react-flow__edge-path')).toHaveAttribute('marker-start', 'url(#arrow-backward)');
  await page.getByRole('button', { name: 'Edit Graph Type' }).click();
  await openTypeOnCanvas(page, 'edge');
  await expect(direction).toHaveText('Person <- Company');
  await expect(page.getByRole('combobox', { name: 'Multi Edge Key Mode' })).toHaveText('Customize');
  await expect(page.getByRole('textbox', { name: 'Prop Name' })).toHaveValue('seq');
  await expect(page.getByRole('checkbox', { name: 'Multi Edge Key', exact: true })).toBeChecked();
});

test('canvas duplication is local to the new node and deleting an endpoint drops its connected edge', async ({
  page,
  api,
}) => {
  serveGraphType(api, 'People', ['Person', 'Company'], { name: 'WorksAt', pattern: '(Person)-[WorksAt]->(Company)' });
  setSavedLayout(api);
  await page.goto(typeList + '/edit/People');
  const person = node(page, 'Person');
  await connectNodes(
    page,
    person.locator('.react-flow__handle.source[data-handlepos="top"]'),
    person.locator('.react-flow__handle.target[data-handlepos="left"]')
  );
  await page.getByRole('textbox', { name: 'Edge Type Name' }).fill('Mentors');
  await expect(page.getByRole('combobox', { name: 'Direction' })).toHaveText('Person -> Person');
  await expect(canvas(page).getByText('Mentors', { exact: true })).toBeVisible();
  await person.click();
  await expect(page.getByRole('textbox', { name: 'Node type name' })).toHaveValue('Person');
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(node(page, 'Person_copy')).toBeVisible();
  // Delete the currently selected original, leaving the copy in place.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(node(page, 'Person')).toHaveCount(0);
  await expect(node(page, 'Person_copy')).toBeVisible();
  await expect(node(page, 'Company')).toBeVisible();
  await expect(canvas(page).getByText('WorksAt', { exact: true })).toHaveCount(0);
  await expect(canvas(page).getByText('Mentors', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const ddl = page.locator('.monaco-editor .view-lines');
  await expect(ddl).toContainText('ADD NODE `Person_copy`');
  await expect(ddl).toContainText('DROP NODE `Person`');
  await expect(ddl).toContainText('DROP EDGE `WorksAt`');
});

test('retries saving a canvas layout, carries it to a renamed GraphType and removes the deleted type', async ({
  page,
  api,
}) => {
  const renamed = 'RenamedPeople';
  const nodes = ['Person', 'Company'];
  api.types.push('UnrelatedType');
  serveGraphType(api, 'People', nodes, undefined, (gql) => {
    if (gql.trim() !== 'RENAME GRAPH TYPE `People` TO `RenamedPeople`') return;
    api.types = api.types.map((name) => (name === 'People' ? renamed : name));
    serveGraphType(api, renamed, nodes, undefined, (command) => {
      if (command !== 'DROP GRAPH TYPE IF EXISTS `RenamedPeople`') return;
      api.types = api.types.filter((name) => name !== renamed);
      return table([]);
    });
    return table([]);
  });
  setSavedLayout(api);
  const readGraphType = api.override;
  let writes = 0;
  api.override = async (path, request) => {
    if (path === '/explorer/global-config/upsert' && request.postDataJSON().key === layoutKey && ++writes === 1) {
      return failure('Layout write refused');
    }
    return readGraphType?.(path, request);
  };

  await page.goto(typeList + '/view/People');
  const person = node(page, 'Person');
  const company = node(page, 'Company');
  await expect(person).toBeVisible();
  await expect(person.locator('.react-flow__handle.connectable')).toHaveCount(0);
  await expect(page.locator('[draggable="true"]').filter({ hasText: /^Add$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Graph Type' }).click();
  await expect(page).toHaveURL(typeList + '/edit/People');
  await expect(person.locator('.react-flow__handle.connectable')).not.toHaveCount(0);
  await expect.poll(() => position(person)).toEqual(savedPositions.Person);

  for (const status of [400, 200]) {
    await person.hover();
    const persisting = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api-studio/explorer/global-config/upsert'
    );
    const box = (await person.boundingBox())!;
    await drag(page, person, { x: box.x + box.width / 2 + 35, y: box.y + box.height / 2 + 50 });
    expect((await persisting).status()).toBe(status);
    await expect(company).toBeVisible();
  }
  expect(writes).toBe(2);
  const saved = JSON.parse(api.config.get(layoutKey)!).nodes;
  expect(saved.Company).toEqual(savedPositions.Company);
  expect(saved.Person.y).toBeGreaterThan(savedPositions.Person.y + 30);
  expect((await position(person)).y).toBeCloseTo(saved.Person.y, 2);

  await page.getByRole('button', { name: 'Cancel Edit GraphType' }).click();
  await expect(page).toHaveURL(typeList + '/view/People');
  await page.reload();
  await expect(person).toBeVisible();
  await expect(company).toBeVisible();
  await expect.poll(async () => (await position(person)).y).toBeCloseTo(saved.Person.y, 2);
  expect((await position(company)).y).toBeCloseTo(saved.Company.y, 2);

  await page.getByRole('button', { name: 'Edit Graph Type' }).click();
  await expect.poll(async () => (await position(person)).y).toBeCloseTo(saved.Person.y, 2);
  await page.getByRole('textbox', { name: 'Graph Type Name' }).fill(renamed);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Commit Edit', exact: true }).click();
  await expect(page).toHaveURL(typeList);
  const renamedKey = layoutKey.replace(/People$/, renamed);
  await expect.poll(() => api.config.get(renamedKey)).toBeTruthy();
  expect(JSON.parse(api.config.get(renamedKey)!).nodes).toEqual(saved);

  await page.goto(typeList + '/view/' + renamed);
  for (const [entity, expected] of [
    [person, saved.Person],
    [company, saved.Company],
  ] as const) {
    await expect
      .poll(async () => {
        const { x, y } = await position(entity);
        return Math.hypot(x - expected.x, y - expected.y);
      })
      .toBeLessThan(0.02);
  }
  await page.goto(typeList);
  const renamedCard = page.locator('.MuiCard-root').filter({ hasText: renamed });
  await renamedCard.getByRole('button', { name: '', exact: true }).click();
  await page.getByText('Delete', { exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.locator('.MuiCard-root').filter({ hasText: 'UnrelatedType' })).toBeVisible();
  await expect(renamedCard).toHaveCount(0);
});

test('canvas and table edits share labels, property constraints and the generated alteration', async ({
  page,
  api,
}) => {
  serveSchemaTypes(api, [
    {
      schemaPath: '/initial',
      name: 'People',
      node: [
        identifier,
        { property_name: 'alias', data_type: 'STRING', nullable: true },
        { property_name: 'score', data_type: 'INT16', nullable: true },
        { property_name: 'legacy', data_type: 'BOOL', nullable: true },
      ],
      edge: [],
    },
  ]);
  await page.goto(typeList + '/edit/People');
  await openTypeOnCanvas(page, 'node');
  await expect(page.getByRole('checkbox', { name: 'Primary Key: id' })).toBeDisabled();
  const label = page.getByRole('combobox', { name: 'Label', exact: true });
  await label.fill('Reviewed');
  await label.press('Tab');
  await expect(page.locator('.MuiChip-label').filter({ hasText: /^Reviewed$/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Prop Name' }).nth(1).fill('display_name');
  await page.getByRole('button', { name: 'Delete: legacy' }).click();
  await canvas(page)
    .locator('.react-flow__pane')
    .click({ position: { x: 105, y: 120 } });
  await expect(page.getByRole('textbox', { name: 'Node type name' })).toHaveCount(0);
  await openTypeOnCanvas(page, 'edge');
  await label.fill('TeamLink');
  await label.press('Tab');
  await expect(page.locator('.MuiChip-label').filter({ hasText: /^TeamLink$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Label', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Reviewed' })).toContainText('Person');
  await page.getByRole('tab', { name: 'Edge Type', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'TeamLink' })).toContainText('WorksAt');
  await page.getByRole('button', { name: 'Node Type', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Person' }).getByRole('button', { name: 'Edit Node Type' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Node Type' });
  await expect(dialog.getByRole('textbox', { name: 'Prop Name' }).nth(1)).toHaveValue('display_name');
  await expect(dialog.getByRole('textbox', { name: 'Prop Name' })).toHaveCount(3);
  await dialog.getByRole('combobox', { name: 'Prop Type' }).nth(2).fill('INT32');
  await page.getByRole('option', { name: 'INT32', exact: true }).click();
  await dialog.getByRole('button', { name: 'More settings: score' }).click();
  await page.locator('input[name="properties.2.nullable"]').uncheck();
  await page.locator('input[aria-label="Default Value"]').fill('42');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Visual Builder', exact: true }).click();
  await openTypeOnCanvas(page, 'node');
  await expect(page.getByRole('combobox', { name: 'Prop Type' }).nth(2)).toHaveValue('INT32');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const ddl = page.locator('.monaco-editor .view-lines');
  for (const clause of [
    'ALTER NODE `Person`',
    'ADD LABELS `Reviewed`',
    'DROP PROPERTIES {`legacy`}',
    'MODIFY PROPERTIES {`score` INT32 NOT NULL DEFAULT 42}',
    'RENAME PROPERTIES {`alias` TO `display_name`}',
    'ALTER EDGE `WorksAt` ADD LABELS `TeamLink`',
  ]) {
    await expect(ddl).toContainText(clause);
  }
});

test('schema canvas zooms, pans, toggles force layout and returns from fullscreen', async ({ page, api }) => {
  serveGraphType(api, 'People', ['Person', 'Company'], { name: 'WorksAt', pattern: '(Person)-[WorksAt]->(Company)' });
  setSavedLayout(api);
  await page.goto(typeList + '/view/People');
  await expect(node(page, 'Person')).toBeVisible();
  const zoomIn = page.getByRole('button', { name: 'Zoom In' });
  const zoomOut = page.getByRole('button', { name: 'Zoom Out' });
  const viewport = canvas(page).locator('.react-flow__viewport');
  const scale = () => viewport.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
  const zoomedOut = await scale();
  await zoomIn.click();
  await expect.poll(scale).toBeGreaterThan(zoomedOut);
  const zoomedIn = await scale();
  await zoomOut.click();
  await expect.poll(scale).toBeLessThan(zoomedIn);
  const before = await position(viewport);
  const { x, y } = (await canvas(page).boundingBox())!;
  await page.mouse.move(x + 95, y + 96);
  await page.mouse.down();
  await page.mouse.move(x + 148, y + 136, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await position(viewport)).x).toBeGreaterThan(before.x + 35);
  const fullscreen = page.getByRole('button', { name: 'Fullscreen' });
  await fullscreen.click();
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await canvas(page).boundingBox())!.width).toBeGreaterThan(1470);
  await fullscreen.click();
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Start Force Layout' }).click();
  const stop = page.getByRole('button', { name: 'Stop Force Layout' });
  await expect(stop).toHaveAttribute('aria-pressed', 'true');
  await stop.click();
  await expect(page.getByRole('button', { name: 'Start Force Layout' })).toHaveAttribute('aria-pressed', 'false');
});
