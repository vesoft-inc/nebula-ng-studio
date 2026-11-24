import { expect, type Locator, type Page } from '@playwright/test';
import { test, type StudioApi } from '../support/web';
import { failure, table, type Reply } from '../support/http';
import { gate } from '../support/browser';

const peopleGraph = 'people-demo';
const person = (id: number, name: string, age: number) => ({
  id,
  graph: peopleGraph,
  type: 'Person',
  labels: ['Person'],
  properties: { name, age },
});
const ada = person(11, 'Ada', 36);
const lin = person(12, 'Lin', 24);
const grace = person(13, 'Grace', 43);

const nodeValue = (node: ReturnType<typeof person>) => ({ type: 'NODE', raw: String(node.id), value: node });
const friendship = (source: typeof ada, target: typeof ada) => ({
  type: 'PATH',
  raw: source.id + ' -> ' + target.id,
  value: [
    source,
    {
      srcId: source.id,
      dstId: target.id,
      isDirected: true,
      rank: 0,
      graph: peopleGraph,
      type: 'Knows',
      labels: [],
      properties: { since: 2020 },
    },
    target,
  ],
});

function addExploration(api: StudioApi, id: string, nodes: (typeof ada)[] = [], selected: number[] = []) {
  const data = JSON.stringify({
    nodes: nodes.map((node) => String(node.id)),
    nodesSelected: selected.map(String),
    nowDataMap: Object.fromEntries(
      nodes.map((node, index) => [
        node.id,
        { data: nodeValue(node), label: node.properties.name, color: '#2365a2', x: index * 90, y: 0 },
      ])
    ),
  });
  api.snapshots.set(id, {
    id,
    name: 'People ' + id,
    graph: peopleGraph,
    graph_type: 'People',
    schemaPath: '/initial',
    data,
  });
  return '/studio/explorer/snapshots/' + id;
}

function servePeople(api: StudioApi, query?: (gql: string, timeout: number) => Reply | Promise<Reply>) {
  api.override = async (path, request) => {
    if (path !== '/gql/exec' || request.method() !== 'POST') return;
    const { gql, timeout } = request.postDataJSON() as { gql: string; timeout: number };
    if (gql === 'CALL describe_graph_type("People") RETURN *') {
      return table([
        {
          type_name: 'Person',
          entity_type: 'Node',
          labels: ['Person'],
          properties: ['name', 'age'],
          'primary_key/multiedge_key': ['name'],
        },
        {
          type_name: 'Knows',
          entity_type: 'Edge',
          labels: [],
          properties: ['since'],
          type_pattern: '(Person)-[Knows]->(Person)',
          'primary_key/multiedge_key': 'Unique',
        },
      ]);
    }
    if (gql.includes('CALL describe_node_type(gtn, type_name)')) {
      return table([
        { type_name: 'Person', property_name: 'name', data_type: 'STRING', primary_key: 'Y' },
        { type_name: 'Person', property_name: 'age', data_type: 'INT32', primary_key: 'N' },
      ]);
    }
    if (gql.includes('CALL describe_edge_type(gtn, type_name)')) {
      return table([{ type_name: 'Knows', property_name: 'since', data_type: 'INT32', multi_edge_key: 'N' }]);
    }
    if (gql.includes(' MATCH ')) return query?.(gql, timeout);
    return undefined;
  };
}

async function openQuery(page: Page, queryType: 'Query Node' | 'Explore Relation' | 'Query Path') {
  await page.getByRole('button', { name: 'Graph Query', exact: true }).click();
  await page.getByRole('button', { name: queryType, exact: true }).click();
  return page.getByRole('button', { name: 'Query', exact: true });
}

async function choose(page: Page, select: Locator, option: string | RegExp) {
  await select.click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
}

const selection = (page: Page, nodes: number, edges: number) =>
  page.getByRole('button', { name: new RegExp('Selected Nodes\\s*' + nodes + '\\s*Selected Edges\\s*' + edges + '$') });

async function saveExploration(page: Page, id: string) {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === '/api-studio/explorer/snapshots/' + id
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await (await saved).json()).toMatchObject({ code: 0 });
  await expect(page.getByText('Save Success', { exact: false })).toBeVisible();
}

test('Query Node validates input, recovers from failure and persists the returned nodes', async ({ page, api }) => {
  let queries = 0;
  servePeople(api, (gql, timeout) => {
    expect(gql).toContain('USE `people-demo`');
    expect(gql).toContain('MATCH (v@`Person` where v.`name` in LIST["Ada","Lin"]) return v limit 100');
    expect(timeout).toBe(120000);
    if (++queries === 1) return failure('Node lookup refused');
    return queries === 2 ? table([]) : table([{ v: nodeValue(ada) }, { v: nodeValue(lin) }]);
  });
  await page.goto(addExploration(api, 'lookup'));
  const query = await openQuery(page, 'Query Node');
  await expect(query).toBeDisabled();
  await choose(page, page.getByRole('combobox', { name: 'Node Type' }), 'Person');
  await choose(page, page.getByRole('combobox', { name: 'Property' }), /^name/);
  await expect(query).toBeDisabled();
  await page.getByRole('textbox', { name: 'Value', exact: true }).fill('Ada\n\nLin');

  await query.click();
  await expect(page.getByText('Node lookup refused', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Value', exact: true })).toHaveValue('Ada\n\nLin');
  await expect(selection(page, 2, 0)).toHaveCount(0);
  await query.click();
  await expect(page.getByText('No data found', { exact: true })).toBeVisible();
  await query.click();
  await expect(selection(page, 2, 0)).toBeVisible();
  await saveExploration(page, 'lookup');
  expect(queries).toBe(3);
  expect(JSON.parse(api.snapshots.get('lookup')!.data).nodes).toEqual(['11', '12']);

  await page.reload();
  await expect(selection(page, 2, 0)).toBeVisible();
  await page.getByRole('button', { name: 'Search in Exploration' }).click();
  await page.getByRole('combobox', { name: 'Search in Exploration' }).fill('Lin');
  await page.getByRole('option').filter({ hasText: 'Lin' }).click();
  await expect(selection(page, 1, 0)).toBeVisible();
});

test('Explore Relation uses selected node IDs, edge type, direction and step range', async ({ page, api }) => {
  const response = gate();
  let requests = 0;
  servePeople(api, async (gql) => {
    requests++;
    expect(gql).toContain('PARAMETERS $ids= LIST[11]');
    expect(gql).toMatch(/<-[[]e.*where type\(e\) in \["Knows"\]\]-\{1,3\}\(v1\)/);
    await response.pending;
    return table([{ p: friendship(grace, ada) }]);
  });
  await page.goto(addExploration(api, 'neighbors', [ada], [ada.id]));
  const query = await openQuery(page, 'Explore Relation');
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
  await choose(page, page.getByRole('combobox').filter({ hasText: 'All' }), 'Knows');
  await page.keyboard.press('Escape');
  await choose(page, page.getByRole('combobox').filter({ hasText: 'Forward' }), /Backward$/);
  await page.getByRole('radio', { name: 'Range', exact: true }).press('Space');
  await page.getByRole('spinbutton', { name: 'Min Step' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Max Step' }).fill('3');
  await query.click();
  await expect.poll(() => requests).toBe(1);
  response.release();
  await expect(selection(page, 2, 1)).toBeVisible();
  await saveExploration(page, 'neighbors');
  const data = JSON.parse(api.snapshots.get('neighbors')!.data);
  expect(data.nodes).toEqual(expect.arrayContaining(['11', '13']));
  expect(data.links.map((id: string) => data.nowDataMap[id].data.value)).toEqual([
    expect.objectContaining({ type: 'Knows', srcId: 13, dstId: 11 }),
  ]);
});

test('Query Path requires two selected nodes and passes their ordered keys to the shortest path search', async ({
  page,
  api,
}) => {
  let queries = 0;
  servePeople(api, (gql) => {
    queries++;
    expect(gql).toMatch(
      /MATCH p = ALL SHORTEST TRAIL PATHS \(v@`Person` where v\.`name` = "Lin"\).*->\{2\}\(v1@`Person` where v1\.`name` = "Ada"\)/
    );
    return table([{ p: friendship(lin, ada) }]);
  });
  const single = addExploration(api, 'single', [ada, lin], [lin.id]);
  addExploration(api, 'pair', [ada, lin], [lin.id, ada.id]);
  await page.goto(single);
  await expect(await openQuery(page, 'Query Path')).toBeDisabled();
  expect(queries).toBe(0);
  await page.getByRole('button', { name: 'back', exact: true }).click();
  await page.getByRole('button', { name: 'People pair', exact: true }).click();
  const query = await openQuery(page, 'Query Path');
  await expect(page.getByText('Lin', { exact: true })).toBeVisible();
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'All Shortest', exact: true }).press('Space');
  await choose(page, page.getByRole('combobox').filter({ hasText: 'WALK' }), /^TRAIL/);
  await page.getByRole('spinbutton', { name: 'Step', exact: true }).fill('2');
  await query.click();
  await expect(selection(page, 2, 1)).toBeVisible();
  expect(queries).toBe(1);
});

test('leaving a pending query prevents its result from leaking into the next snapshot', async ({ page, api }) => {
  const started = gate();
  const response = gate();
  servePeople(api, async (gql) => {
    expect(gql).toContain('LIST["Ada"]');
    started.release();
    await response.pending;
    return table([{ v: nodeValue(ada) }]);
  });
  await page.goto(addExploration(api, 'pending'));
  const next = addExploration(api, 'next', [lin], [lin.id]);
  const query = await openQuery(page, 'Query Node');
  await choose(page, page.getByRole('combobox', { name: 'Node Type' }), 'Person');
  await choose(page, page.getByRole('combobox', { name: 'Property' }), /^name/);
  await page.getByRole('textbox', { name: 'Value', exact: true }).fill('Ada');
  await query.click();
  await started.pending;
  try {
    const canceled = page.waitForEvent(
      'requestfailed',
      (request) => request.url().endsWith('/gql/exec') && String(request.postDataJSON()?.gql).includes('LIST["Ada"]')
    );
    await page.getByRole('tab', { name: 'Explorer', exact: true }).click();
    await page.getByRole('button', { name: 'People next', exact: true }).click();
    await expect(page).toHaveURL(next);
    await canceled;
  } finally {
    response.release();
  }
  await expect(query).toHaveCount(0);
  await expect(selection(page, 1, 0)).toBeVisible();
  await saveExploration(page, 'next');
  expect(JSON.parse(api.snapshots.get('next')!.data).nodes).toEqual(['12']);
});

test('the filter panel validates conditions and restores saved rules without removing snapshot data', async ({
  page,
  api,
}) => {
  servePeople(api);
  await page.goto(addExploration(api, 'filters', [ada, lin]));
  const filters = page.getByRole('button', { name: 'Exploration Result Filter' });
  const apply = page.getByRole('checkbox', { name: 'Apply', exact: true });
  await filters.click();
  await apply.press('Space');
  await expect(apply).not.toBeChecked();
  await choose(page, page.getByRole('combobox', { name: 'Node/Edge Type' }), 'Person');
  await choose(page, page.getByRole('combobox', { name: 'Property', exact: false }), /^age/);
  await choose(page, page.getByRole('combobox', { name: 'Operator' }), '>=');
  await page.getByRole('textbox', { name: 'Value', exact: true }).fill('30');
  await page.getByRole('radio', { name: 'Hide', exact: true }).press('Space');
  await apply.press('Space');
  await expect(apply).toBeChecked();
  await page.getByRole('button', { name: 'Add Filter' }).click();
  await expect(apply).toHaveCount(2);
  await expect(apply.nth(1)).not.toBeChecked();
  await saveExploration(page, 'filters');
  const data = JSON.parse(api.snapshots.get('filters')!.data);
  expect(data.nodes).toEqual(['11', '12']);
  expect(data.filterType).toBe('hide');
  expect(data.filterList).toEqual([
    expect.objectContaining({ entity_name: 'Person', property_name: 'age', operator: '>=', value: '30', enable: true }),
  ]);

  await page.reload();
  await filters.click();
  await expect(page.getByRole('radio', { name: 'Hide', exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Value', exact: true })).toHaveValue('30');
  await expect(apply).toBeChecked();
  // The unlabeled delete control is next to this rule's Apply switch.
  await page.locator('label:has(input[name="conditions.0.enable"]) + button').click();
  await expect(apply).toHaveCount(0);
  await saveExploration(page, 'filters');
  expect(JSON.parse(api.snapshots.get('filters')!.data).filterList).toEqual([]);
});

test('node and edge display properties are restored independently from the saved snapshot', async ({ page, api }) => {
  servePeople(api);
  await page.goto(addExploration(api, 'properties', [ada, lin]));
  const properties = page.getByRole('button', { name: 'Graph Property' });
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  const age = page.getByRole('checkbox', { name: 'age', exact: true });
  const since = page.getByRole('checkbox', { name: 'since', exact: true });
  const nodeType = page.getByRole('button', { name: 'Node Type', exact: true });
  const edgeType = page.getByRole('button', { name: 'Edge Type', exact: true });

  await properties.click();
  await expect(page.getByRole('checkbox', { name: 'name', exact: true })).toBeChecked();
  await expect(age).not.toBeChecked();
  await age.press('Space');
  await confirm.click();
  await edgeType.click();
  await expect(since).not.toBeChecked();
  await since.press('Space');
  await confirm.click();
  await saveExploration(page, 'properties');
  expect(JSON.parse(api.snapshots.get('properties')!.data)).toMatchObject({
    displayedNodePropertyItems: [{ type_name: 'Person', properties: ['name', 'age'] }],
    displayedEdgePropertyItems: [{ type_name: 'Knows', properties: ['since'] }],
  });

  await page.reload();
  await properties.click();
  await expect(age).toBeChecked();
  await edgeType.click();
  await expect(since).toBeChecked();
  await nodeType.click();
  await expect(age).toBeChecked();
});
