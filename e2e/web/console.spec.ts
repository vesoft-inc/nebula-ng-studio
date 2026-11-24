import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from '../support/web';
import { signIn, readResult, disconnect, runQuery, runButton, gate, enterQuery } from '../support/browser';
import { failure, ok, table } from '../support/http';

test('opens query plans, shows warnings and exports the profiled result', async ({ page, api }) => {
  const explain = 'EXPLAIN MATCH (n) RETURN n';
  const profile = 'PROFILE USE `people-demo` MATCH (n) SET n.age = 42 RETURN n.age AS age';
  const plan = (name: string) => ({
    id: name,
    name,
    details: '',
    columns: ['age'],
    timeMs: 4,
    rows: 1,
    memoryKib: 0,
    blockedMs: 0,
    queuedMs: 0,
    consumeMs: 0,
    produceMs: 0,
    finishMs: 0,
    batches: 0,
    concurrency: 1,
    otherStatsJson: '',
    children: [],
  });
  api.query = async (gql) => {
    if (gql === explain) {
      return ok({ headers: [], tables: [], summary: { explainType: 'explain', planInfo: plan('NodeScan') } });
    }
    if (gql === profile) {
      return ok({
        headers: ['age'],
        tables: [{ age: 42 }],
        summary: {
          explainType: 'profile',
          rowsCount: 1,
          totalServerTimeUs: 4000,
          planInfo: plan('SetProperty'),
          queryStats: { numAffectedNodes: 1, numAffectedEdges: 0 },
        },
      });
    }
    return undefined;
  };
  api.override = async (path, request) => {
    if (
      path === '/nebula/console/execGql' &&
      request.postDataJSON().gql === 'SHOW WARNINGS' &&
      api.consoleRequests.at(-1) === profile
    ) {
      return table([{ code: 'W01', message: 'Node property was updated' }]);
    }
    return undefined;
  };

  await page.goto('/studio/console');
  await runQuery(page, explain);
  const planTab = page.getByRole('tab', { name: 'Execution Plan', exact: true });
  await expect(planTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('NodeScan', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Table', exact: true })).toHaveCount(0);

  await runQuery(page, profile);
  await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible();
  await page.getByText('Warning: 1', { exact: true }).hover();
  await expect(page.getByRole('tooltip', { name: 'W01: Node property was updated' })).toBeVisible();
  await planTab.first().click();
  await expect(page.locator('.react-flow__node').getByText('SetProperty', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Stats', exact: true }).click();
  await expect(page.getByText('Affected nodes: 1')).toBeVisible();
  await page.getByRole('tab', { name: 'Raw', exact: true }).click();
  await expect(page.locator('.monaco-editor .view-lines').filter({ hasText: '"age": 42' })).toBeVisible();

  for (const format of ['CSV', 'JSON']) {
    await page.getByRole('button', { name: 'Export', exact: true }).first().click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText('Export as ' + format, { exact: true }).click(),
    ]);
    const body = await readFile(await download.path(), 'utf8');
    if (format === 'JSON') expect(JSON.parse(body.replace(/^\uFEFF/, '')).tables).toEqual([{ age: 42 }]);
    else expect(body.replaceAll('"', '')).toMatch(/age\r?\n42/);
  }
  expect(api.consoleRequests).toEqual([explain, profile]);
});

test('login retries return to the protected deep link and logout protects browser history', async ({ page, api }) => {
  api.user = null;
  let attempts = 0;
  api.override = async (path) =>
    path === '/db/connect' && ++attempts === 1 ? failure('Invalid fixture password') : undefined;
  const target = '/studio/console?view=table#history';
  await page.goto(target);
  await signIn(page, 'alice', 'incorrect');
  await readResult(page, 'Invalid fixture password');
  await signIn(page, 'alice', 'correct');
  await expect(page).toHaveURL(target);
  await page.getByRole('tab', { name: 'Schema', exact: true }).click();
  await expect(page).toHaveURL(/schema-manager/);
  await disconnect(page, 'alice');
  await expect(page).toHaveURL(/\/login/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('input[name=password]')).toBeVisible();
  await expect(runButton(page)).toHaveCount(0);
});
test('a pending Console query runs once and results and draft survive a route round trip', async ({ page, api }) => {
  const response = gate();
  api.query = async (gql, req) => {
    expect(gql).toMatch(/RETURN 42/);
    expect(req.postDataJSON().timeout).toBe(120000);
    await response.pending;
    return table([{ answer: 'persistent-result' }]);
  };
  await page.goto('/studio/console');
  await runQuery(page, 'RETURN 42');
  await expect(runButton(page)).toBeDisabled();
  await page.getByRole('textbox', { name: 'Editor content' }).press('Shift+Enter');
  response.release();
  await readResult(page, 'persistent-result');
  await enterQuery(page, 'RETURN 43');
  await page.getByRole('tab', { name: 'Schema', exact: true }).click();
  await expect(page).toHaveURL(/schema-manager/);
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await readResult(page, 'persistent-result');
  await expect(page.locator('.monaco-editor:not(.readonly)').first()).toContainText('RETURN 43');
  expect(api.consoleRequests).toHaveLength(1);
});
test('an error stops subsequent statements and a new query recovers', async ({ page, api }) => {
  api.query = async (gql) =>
    gql.includes('broken') ? failure('Rejected statement') : table([{ answer: 'recovered-result' }]);
  await page.goto('/studio/console');
  await runQuery(page, '"""RETURN broken""" RETURN skipped');
  await readResult(page, 'Rejected statement');
  await runQuery(page, 'RETURN 42');
  await readResult(page, 'recovered-result');
  expect(api.consoleRequests).toEqual([expect.stringMatching(/RETURN broken$/), expect.stringMatching(/RETURN 42$/)]);
});

test('late work from Alice stays out of Bob’s Console after session expiry', async ({ page, api }) => {
  const response = gate(),
    started = gate(),
    released = gate();
  api.query = async (gql) => {
    if (gql.includes('slow')) {
      started.release();
      await response.pending;
      released.release();
      return table([{ answer: 'alice-private' }]);
    }
    return table([{ answer: 'bob-only' }]);
  };
  await page.goto('/studio/console');
  await runQuery(page, 'RETURN slow');
  await started.pending;
  api.override = async (path) =>
    path === '/explorer/snapshots' ? failure('Session expired', 40104001, 401) : undefined;
  await page.getByRole('tab', { name: 'Explorer', exact: true }).click();
  await expect(page.locator('input[name=password]')).toBeVisible();
  api.override = undefined;
  api.loginAs = 'bob';
  await signIn(page, 'bob', 'correct');
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await runQuery(page, 'RETURN 2');
  await readResult(page, 'bob-only');
  response.release();
  await released.pending;
  await expect(page.getByRole('button', { name: 'bob', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: /alice-private/ })).toHaveCount(0);
});
test('schema switching preserves results after a rejection and clears them on success', async ({ page, api }) => {
  api.query = async () => table([{ answer: 'initial-result' }]);
  await page.goto('/studio/console');
  await runQuery(page, 'RETURN 1');
  await readResult(page, 'initial-result');
  await page.getByRole('tab', { name: 'Schema', exact: true }).click();
  let attempts = 0;
  api.override = async (path) =>
    path === '/nebula/changeSchema' && ++attempts === 1 ? failure('Schema switch rejected') : undefined;
  async function selectOther() {
    await page.getByRole('button', { name: 'initial', exact: true }).click();
    await page.getByText('/other', { exact: true }).click();
  }
  await selectOther();
  await readResult(page, 'Schema switch rejected');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await readResult(page, 'initial-result');
  await page.getByRole('tab', { name: 'Schema', exact: true }).click();
  await selectOther();
  await expect(page.getByRole('button', { name: 'other', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await expect(runButton(page)).toBeEnabled();
  await expect(page.getByRole('cell', { name: /initial-result/ })).toHaveCount(0);
});
