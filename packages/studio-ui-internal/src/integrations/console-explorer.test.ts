import { afterEach, describe, expect, it, vi } from 'vitest';
import { observable } from 'mobx';
import { HttpResCode, type ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { NodeObject } from '@vesoft-inc/force-graph';
import ConsoleController from '../console/ConsoleController';
import SchemaController from '../schema/SchemaController';
import type { GraphWorkspaceStore } from '../graph/stores/workspace';
import type { SnapshotData } from '../graph/types/explorer';
import type { SnapshotRecord } from '../contracts/snapshot';
import { RawEntityType } from '../graph/types/gql';
import type { QueryExecutor } from '../shared/query';
import { ensureExplorerSnapshot, type ConsoleExplorerOptions } from '../entries/console-explorer';

const controllers: Array<{ destroy: () => void }> = [];
afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
});

function setup() {
  const execute = vi.fn<QueryExecutor>().mockResolvedValue({ code: 0, message: '', data: { tables: [] } });
  const query = vi.fn<QueryExecutor>().mockResolvedValue({ code: 0, message: '', data: { tables: [] } });
  const consoleController = new ConsoleController({ execute: execute as QueryExecutor, query: query as QueryExecutor });
  const schemaController = new SchemaController({ execute: execute as QueryExecutor });
  controllers.push(consoleController, schemaController);
  schemaController.updateCurrentSchame({ path: '/demo' });
  consoleController.graphs = [{ graph: 'people', graph_type: 'Person', owner: '', schema: '/demo', index_cnt: 0 }];

  const node = {
    id: 'person-1',
    data: {
      type: RawEntityType.NODE,
      raw: '',
      value: { id: 1, graph: 'people', type: 'Person', labels: [], properties: { name: 'Alice' } },
    },
  } as NodeObject;
  const data: SnapshotData = {
    nodes: [node],
    links: [],
    nodesSelected: observable.set([node], { deep: false }),
    linksSelected: observable.set(),
    nowDataMap: new Map([[node.id!, node]]),
    displayedNodePropertyItems: observable.array(),
    displayedEdgePropertyItems: observable.array(),
    filterList: observable.array(),
    imagesCache: new Map([['person', 'data:image/png;base64,dGVzdA==']]),
  };
  const workspace = {
    graph: { loading: false, isEmpty: false, toSnapShotData: vi.fn(() => data) },
    destroy: vi.fn(),
  };
  consoleController.graphWorkspaces.set('result-1', workspace as unknown as GraphWorkspaceStore);
  const snapshots = {
    read: vi.fn<ConsoleExplorerOptions['snapshots']['read']>(),
    create: vi
      .fn<ConsoleExplorerOptions['snapshots']['create']>()
      .mockResolvedValue({ code: 0, message: '', data: { id: 'new-snapshot' } }),
  };
  const options: ConsoleExplorerOptions = {
    result: { id: 'result-1', gql: 'MATCH (n) RETURN n' },
    graph: 'people',
    consoleController,
    schemaController,
    snapshots,
    snapshotVersion: 'test-version',
  };
  return { options, execute, query, workspace, data, snapshots, consoleController, schemaController };
}

describe('Console to Explorer integration without a browser or application stores', () => {
  it('creates a snapshot with serialized data and records the result association', async () => {
    const { options, snapshots, consoleController, query } = setup();
    await expect(ensureExplorerSnapshot(options)).resolves.toEqual({ snapshotId: 'new-snapshot' });

    const payload = snapshots.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: 'Console: MATCH (n) RETURN n',
      graph: 'people',
      graph_type: 'Person',
      schema_path: '/demo',
    });
    expect(JSON.parse(payload.data!)).toMatchObject({
      version: 'test-version',
      nodes: ['person-1'],
      nodesSelected: ['person-1'],
      imagesCache: [['person', 'data:image/png;base64,dGVzdA==']],
      nowDataMap: { 'person-1': { data: { value: { properties: { name: 'Alice' } } } } },
    });
    expect(consoleController.getResultSnapshot('result-1')).toEqual({ snapshotId: 'new-snapshot', graph: 'people' });
    expect(snapshots.read).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('reuses an existing snapshot even when the live workspace is unavailable', async () => {
    const { options, snapshots, consoleController, workspace } = setup();
    consoleController.setResultSnapshot('result-1', { snapshotId: 'existing', graph: 'people' });
    consoleController.graphWorkspaces.delete('result-1');
    snapshots.read.mockResolvedValue({ code: 0, message: '', data: { id: 'existing' } as SnapshotRecord });

    await expect(ensureExplorerSnapshot({ ...options, graph: undefined })).resolves.toEqual({ snapshotId: 'existing' });
    expect(snapshots.read).toHaveBeenCalledWith('existing');
    expect(snapshots.create).not.toHaveBeenCalled();
    expect(workspace.graph.toSnapShotData).not.toHaveBeenCalled();
  });

  it('recreates a deleted snapshot using the graph from its original association', async () => {
    const { options, snapshots, consoleController } = setup();
    consoleController.setResultSnapshot('result-1', { snapshotId: 'deleted', graph: 'people' });
    snapshots.read.mockResolvedValue({ code: HttpResCode.ErrNotFound, message: 'missing' });
    snapshots.create.mockImplementation(async (payload) => {
      expect(consoleController.getResultSnapshot('result-1')).toBeUndefined();
      expect(payload.graph).toBe('people');
      return { code: 0, message: '', data: { id: 'replacement' } };
    });

    await expect(ensureExplorerSnapshot({ ...options, graph: 'different' })).resolves.toEqual({
      snapshotId: 'replacement',
    });
    expect(consoleController.getResultSnapshot('result-1')).toEqual({ snapshotId: 'replacement', graph: 'people' });
  });

  it.each([
    { code: HttpResCode.ErrForbidden, message: 'Server::forbidden' },
    { code: 0, message: 'missing snapshot data' },
  ])('keeps the association when reading a snapshot fails: $message', async (response) => {
    const { options, snapshots, consoleController } = setup();
    consoleController.setResultSnapshot('result-1', { snapshotId: 'existing', graph: 'people' });
    snapshots.read.mockResolvedValue(response);

    await expect(ensureExplorerSnapshot(options)).rejects.toThrow(response.message.replace(/^\w+::/, ''));
    expect(consoleController.getResultSnapshot('result-1')?.snapshotId).toBe('existing');
    expect(snapshots.create).not.toHaveBeenCalled();
  });

  it('propagates transport errors without recreating or unlinking a snapshot', async () => {
    const { options, snapshots, consoleController } = setup();
    consoleController.setResultSnapshot('result-1', { snapshotId: 'existing', graph: 'people' });
    const error = new Error('network unavailable');
    snapshots.read.mockRejectedValue(error);

    await expect(ensureExplorerSnapshot(options)).rejects.toBe(error);
    expect(consoleController.getResultSnapshot('result-1')?.snapshotId).toBe('existing');
    expect(snapshots.create).not.toHaveBeenCalled();
  });

  it.each(['no graph', 'no workspace', 'loading', 'empty'])('skips an unavailable result: %s', async (reason) => {
    const { options, workspace, snapshots, consoleController } = setup();
    if (reason === 'no graph') options.graph = undefined;
    if (reason === 'no workspace') consoleController.graphWorkspaces.clear();
    if (reason === 'loading') workspace.graph.loading = true;
    if (reason === 'empty') workspace.graph.isEmpty = true;

    await expect(ensureExplorerSnapshot(options)).resolves.toBeNull();
    expect(snapshots.create).not.toHaveBeenCalled();
    expect(workspace.graph.toSnapShotData).not.toHaveBeenCalled();
  });

  it('captures graph data before awaiting graph metadata', async () => {
    const { options, consoleController, query, workspace, data, snapshots } = setup();
    consoleController.graphs = [];
    let finish!: (response: ServerResponse<object>) => void;
    query.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const pending = ensureExplorerSnapshot(options);
    expect(workspace.graph.toSnapShotData).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledOnce();
    // The payload must remain usable after the live graph changes or is disposed.
    data.nodes = [];
    data.nowDataMap.clear();
    consoleController.graphWorkspaces.clear();
    finish({ code: 0, message: '', data: { tables: [{ graph_type_name: 'Person' }] } });

    await pending;
    expect(JSON.parse(snapshots.create.mock.calls[0][0].data!).nodes).toEqual(['person-1']);
    expect(snapshots.create.mock.calls[0][0].graph_type).toBe('Person');
    expect(workspace.graph.toSnapShotData).toHaveBeenCalledOnce();
  });

  it('refreshes an unknown schema before using the host fallback', async () => {
    const { options, execute, schemaController, snapshots } = setup();
    schemaController.updateCurrentSchame({ path: '' });
    await ensureExplorerSnapshot({ ...options, schemaPathFallback: '/session-schema' });

    expect(execute).toHaveBeenCalledWith(
      'SHOW CURRENT_SCHEMA',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(snapshots.create.mock.calls[0][0].schema_path).toBe('/session-schema');
  });

  it('does not create a snapshot when graph type resolution fails', async () => {
    const { options, consoleController, snapshots } = setup();
    consoleController.graphs = [];
    await expect(ensureExplorerSnapshot(options)).rejects.toThrow();
    expect(snapshots.create).not.toHaveBeenCalled();
    expect(consoleController.getResultSnapshot('result-1')).toBeUndefined();
  });

  it.each([
    { code: 1, message: 'Server::save failed' },
    { code: 0, message: '' },
  ])('does not record a failed or incomplete creation: $code', async (response) => {
    const { options, snapshots, consoleController } = setup();
    snapshots.create.mockResolvedValue(response);
    await expect(ensureExplorerSnapshot(options)).rejects.toThrow(response.message.replace(/^\w+::/, ''));
    expect(consoleController.getResultSnapshot('result-1')).toBeUndefined();
  });
});
