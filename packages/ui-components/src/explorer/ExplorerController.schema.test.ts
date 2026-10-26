// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { GraphEntityType, PropertyDataType, type DescGraphTypeResult, type ServerResponse } from '@vesoft-inc/utils';
import { GraphWorkspaceStore } from '../graph/stores/workspace';
import type { Snapshot, SnapshotData } from '../graph/types/explorer';
import SchemaController from '../schema/SchemaController';
import type { QueryExecutor } from '../shared/query';
import { ExplorerStore } from './ExplorerController';
import type { SnapshotServices } from './services';

vi.mock('../graph/utils/layouts', () => ({ default: {} }));

const controllers: ExplorerStore[] = [];
afterEach(() => {
  controllers.splice(0).forEach((controller) => {
    controller.destroy();
    controller.schemaStore.destroy();
  });
});

const success = { code: 0, message: '', data: {} };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function snapshot(id: string, schemaPath: string): Snapshot {
  return {
    id,
    schemaPath,
    name: id,
    graph: 'demo',
    graph_type: 'people',
    created_at: '',
    updated_at: '',
    data: JSON.stringify({
      nodes: [],
      links: [],
      nodesSelected: [],
      linksSelected: [],
      nowDataMap: {},
      imagesCache: [],
      displayedNodePropertyItems: [],
      displayedEdgePropertyItems: [],
      filterList: [],
    }) as unknown as SnapshotData,
  };
}

function setup() {
  let sessionSchema = '/b';
  const calls: { gql: string; schema: string }[] = [];
  const person: DescGraphTypeResult = {
    entity_type: GraphEntityType.Node,
    type_name: 'Person',
    labels: [],
    properties: ['id', 'name'],
    'primary_key/multiedge_key': ['id'],
    propertyInfos: ['id', 'name'].map((property_name) => ({
      type_name: 'Person',
      type: GraphEntityType.Node,
      property_name,
      data_type: PropertyDataType.STRING,
      primary_key: property_name === 'id' ? 'Y' : '',
      nullable: false,
      default: '',
    })),
  };
  const execute = vi.fn(async (gql: string) => {
    calls.push({ gql, schema: sessionSchema });
    const tables = gql.includes('describe_node_type')
      ? person.propertyInfos
      : gql.startsWith('CALL describe_graph_type')
        ? [person]
        : [];
    return { code: 0, message: '', data: { tables } };
  });
  const switchRequest = vi.fn<(path: string) => Promise<ServerResponse<object>>>().mockResolvedValue(success);
  const schema = new SchemaController({
    execute: execute as QueryExecutor,
    switchSchema: async (path) => {
      const result = await switchRequest(path);
      if (result.code === 0) sessionSchema = path;
      return result;
    },
  });
  schema.updateCurrentSchame({ path: '/b', name: 'b' });
  const read = vi.fn<SnapshotServices['read']>().mockImplementation(async (id) => ({
    code: 0,
    message: '',
    data: snapshot(id, `/${id}`),
  }));
  const onSchemaChanged = vi.fn();
  const controller = new ExplorerStore({
    settings: {},
    schemaStore: schema,
    services: {
      execute: execute as QueryExecutor,
      onSchemaChanged,
      snapshots: { read, create: vi.fn(), update: vi.fn(), delete: vi.fn(), list: vi.fn() },
    },
  });
  controllers.push(controller);
  const workspace = () => new GraphWorkspaceStore({ execGql: execute as QueryExecutor });
  return { controller, schema, workspace, execute, calls, switchRequest, read, onSchemaChanged };
}

it('waits for the saved schema before loading metadata or allowing graph writes', async () => {
  const { controller, schema, workspace, execute, calls, switchRequest, onSchemaChanged } = setup();
  const change = deferred<ServerResponse<object>>();
  switchRequest.mockReturnValueOnce(change.promise);
  const graph = workspace();
  const opening = controller.openSnapshot('a', graph);
  await vi.waitFor(() => expect(switchRequest).toHaveBeenCalledWith('/a'));
  expect(graph.restoreState).toBe('restoring');
  expect(controller.loading).toBe(true);
  expect(execute).not.toHaveBeenCalled();
  expect(graph.graphEdit.canEdit).toBe(false);

  change.resolve(success);
  await opening;
  await vi.waitFor(() => expect(graph.graphTypeDetails).toHaveLength(1));
  expect(schema.currentSchema.path).toBe('/a');
  expect(onSchemaChanged).toHaveBeenCalledWith('/a');
  expect(graph.restoreState).toBe('ready');
  graph.graphEdit.openAddNode('Person');
  await graph.graphEdit.submit({ id: 'alice', name: 'Alice' });
  expect(calls.filter(({ gql }) => gql.includes('INSERT'))).toEqual([
    { gql: expect.stringContaining('USE `demo` INSERT'), schema: '/a' },
  ]);
  expect(calls.every(({ schema: path }) => path === '/a')).toBe(true);
});

it('opens a snapshot in the current schema without reconnecting the session', async () => {
  const { controller, workspace, switchRequest } = setup();
  const graph = workspace();
  await controller.openSnapshot('b', graph);
  expect(switchRequest).not.toHaveBeenCalled();
  expect(graph.currentSnapshot?.id).toBe('b');
});

it.each(['missing schema', 'failed switch', 'rejected switch'])(
  'prevents graph operations after a %s',
  async (failure) => {
    const { controller, workspace, execute, switchRequest, read, onSchemaChanged } = setup();
    if (failure === 'missing schema') read.mockResolvedValueOnce({ ...success, data: snapshot('a', '') });
    else if (failure === 'failed switch')
      switchRequest.mockResolvedValueOnce({ code: 1, message: 'Schema unavailable', data: {} });
    else switchRequest.mockRejectedValueOnce(new Error('Network Error'));
    const graph = workspace();
    await expect(controller.openSnapshot('a', graph)).rejects.toThrow();
    expect(graph.currentSnapshot).toBeUndefined();
    expect(graph.graphEdit.canEdit).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(onSchemaChanged).not.toHaveBeenCalled();
    expect(graph.restoreState).toBe('ready');
    expect(controller.loading).toBe(false);
  }
);

it('restores the newest snapshot schema behind an earlier pending switch', async () => {
  const { controller, schema, workspace, switchRequest } = setup();
  const change = deferred<ServerResponse<object>>();
  switchRequest.mockReturnValueOnce(change.promise);
  const first = workspace();
  const openingFirst = controller.openSnapshot('a', first);
  await vi.waitFor(() => expect(switchRequest).toHaveBeenCalledWith('/a'));
  const latest = workspace();
  const openingLatest = controller.openSnapshot('b', latest);
  change.resolve(success);
  await Promise.all([openingFirst, openingLatest]);

  expect(switchRequest.mock.calls.map(([path]) => path)).toEqual(['/a', '/b']);
  expect(schema.currentSchema.path).toBe('/b');
  expect(first.currentSnapshot).toBeUndefined();
  expect(first.restoreState).toBe('idle');
  expect(latest.currentSnapshot?.id).toBe('b');
});

it('does not switch schemas when the snapshot detail arrives after leaving Explorer', async () => {
  const { controller, workspace, read, switchRequest, execute } = setup();
  const detail = deferred<ServerResponse<Snapshot>>();
  read.mockReturnValueOnce(detail.promise);
  const opening = controller.openSnapshot('a', workspace());
  controller.destroy();
  detail.resolve({ ...success, data: snapshot('a', '/a') });
  await opening;
  expect(switchRequest).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
  expect(controller.loading).toBe(false);
});
