import { describe, expect, it, vi } from 'vitest';
import type { NodeObject } from '@vesoft-inc/force-graph';
import type { GraphItem, GraphTypeElement } from '@studio/interfaces';
import type { SnapshotData } from '@studio/interfaces/explorer/explorer';
import {
  CONSOLE_SNAPSHOT_NAME_MAX_LENGTH,
  buildHandoffPayload,
  buildSnapshotName,
  ensureSnapshotSchemaPath,
  pickGraphType,
  rankGraphCandidates,
} from './console';

const node = (graph: string, id: string = graph, nodeStyle: { color?: string; type?: string } = {}): NodeObject =>
  ({
    id,
    color: nodeStyle.color,
    data: { value: { graph, type: nodeStyle.type } },
  }) as NodeObject;

const graphItem = (graph: string, graphType: string) => ({ graph, graph_type: graphType }) as GraphItem;

const graphTypeElement = (graphTypeName: string) => ({ graph_type_name: graphTypeName }) as GraphTypeElement;

describe('rankGraphCandidates', () => {
  it('ranks by visible node count and de-duplicates the source graph list', () => {
    expect(
      rankGraphCandidates(
        ['graph_b', 'graph_a', 'graph_b'],
        [node('graph_a'), node('graph_b', 'b-1'), node('graph_b', 'b-2'), node('graph_b', 'b-3')]
      )
    ).toEqual([
      { graph: 'graph_b', nodeCount: 3, colors: [] },
      { graph: 'graph_a', nodeCount: 1, colors: [] },
    ]);
  });

  it('breaks count ties by graph name for a deterministic default', () => {
    expect(rankGraphCandidates(['z_graph', 'a_graph'], [node('z_graph'), node('a_graph')])).toEqual([
      { graph: 'a_graph', nodeCount: 1, colors: [] },
      { graph: 'z_graph', nodeCount: 1, colors: [] },
    ]);
  });

  it('keeps candidates without visible nodes, ranked last', () => {
    expect(rankGraphCandidates(['empty_graph', 'full_graph'], [node('full_graph')])).toEqual([
      { graph: 'full_graph', nodeCount: 1, colors: [] },
      { graph: 'empty_graph', nodeCount: 0, colors: [] },
    ]);
  });

  it('ignores nodes from other graphs and malformed node data', () => {
    const stray = node('other_graph', 'other_graph', { color: '#8ACCFF', type: 'player' });
    const malformed = { id: 'malformed', data: { value: {} } } as NodeObject;
    expect(
      rankGraphCandidates(['graph_a'], [node('graph_a', 'a-1', { color: '#F8CE60', type: 'team' }), stray, malformed])
    ).toEqual([{ graph: 'graph_a', nodeCount: 1, colors: [{ color: '#F8CE60', types: ['team'] }] }]);
  });

  it('returns an empty list when the result has no graph', () => {
    expect(rankGraphCandidates([], [node('graph_a')])).toEqual([]);
  });

  it('lists each graph node colors, most used first', () => {
    expect(
      rankGraphCandidates(
        ['graph_b', 'graph_a'],
        [
          node('graph_a', 'a-1', { color: '#8ACCFF', type: 'player' }),
          node('graph_a', 'a-2', { color: '#8ACCFF', type: 'player' }),
          node('graph_a', 'a-3', { color: '#F8CE60', type: 'team' }),
          node('graph_a', 'a-4', { color: '#F8CE60', type: 'coach' }),
          node('graph_b', 'b-1', { color: '#F78888', type: 'movie' }),
        ]
      )
    ).toEqual([
      {
        graph: 'graph_a',
        nodeCount: 4,
        colors: [
          { color: '#8ACCFF', types: ['player'] },
          { color: '#F8CE60', types: ['team', 'coach'] },
        ],
      },
      { graph: 'graph_b', nodeCount: 1, colors: [{ color: '#F78888', types: ['movie'] }] },
    ]);
  });

  it('keeps the first painted order for equally used colors and node types', () => {
    // Colors are keyed by node type (tag), so a graph with several tags reports several colors.
    expect(
      rankGraphCandidates(
        ['graph_a'],
        [
          node('graph_a', 'a-1', { color: '#8ACCFF', type: 'player' }),
          node('graph_a', 'a-2', { color: '#F8CE60', type: 'team' }),
        ]
      )
    ).toEqual([
      {
        graph: 'graph_a',
        nodeCount: 2,
        colors: [
          { color: '#8ACCFF', types: ['player'] },
          { color: '#F8CE60', types: ['team'] },
        ],
      },
    ]);
  });

  it('keeps colors without a node type, so their tooltip stays empty', () => {
    expect(rankGraphCandidates(['graph_a'], [node('graph_a', 'a-1', { color: '#8ACCFF' })])).toEqual([
      { graph: 'graph_a', nodeCount: 1, colors: [{ color: '#8ACCFF', types: [] }] },
    ]);
  });
});

describe('pickGraphType', () => {
  it('follows the fallback chain: consoleStore.graphs → graphTypeInfo → schema graphs', () => {
    const graphTypeInfo = new Map<string, GraphTypeElement[]>([['demo', [graphTypeElement('demo_type')]]]);

    expect(
      pickGraphType({
        graph: 'demo',
        consoleGraphs: [graphItem('demo', 'from_console')],
        graphTypeInfo,
        schemaGraphs: [graphItem('demo', 'from_schema')],
      })
    ).toBe('from_console');

    expect(
      pickGraphType({
        graph: 'demo',
        consoleGraphs: [],
        graphTypeInfo,
        schemaGraphs: [graphItem('demo', 'from_schema')],
      })
    ).toBe('demo_type');

    expect(
      pickGraphType({
        graph: 'demo',
        consoleGraphs: [],
        graphTypeInfo: new Map(),
        schemaGraphs: [graphItem('demo', 'from_schema')],
      })
    ).toBe('from_schema');
  });

  it('returns undefined when no source knows the graph type', () => {
    expect(
      pickGraphType({ graph: 'demo', consoleGraphs: [], graphTypeInfo: new Map(), schemaGraphs: [] })
    ).toBeUndefined();
  });
});

describe('ensureSnapshotSchemaPath', () => {
  it('returns the loaded path without refreshing', async () => {
    const refresh = vi.fn(async () => undefined);
    await expect(ensureSnapshotSchemaPath({ getPath: () => '/schema/loaded', refresh })).resolves.toBe(
      '/schema/loaded'
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes the current schema when the path is empty', async () => {
    let path = '';
    const refresh = vi.fn(async () => {
      path = '/schema/refreshed';
    });
    await expect(
      ensureSnapshotSchemaPath({ getPath: () => path, refresh, fallback: () => '/schema/fallback' })
    ).resolves.toBe('/schema/refreshed');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('falls back to the session schema path and finally to an empty string', async () => {
    const refresh = vi.fn(async () => undefined);
    await expect(
      ensureSnapshotSchemaPath({ getPath: () => '', refresh, fallback: () => '/schema/fallback' })
    ).resolves.toBe('/schema/fallback');
    await expect(ensureSnapshotSchemaPath({ getPath: () => '', refresh })).resolves.toBe('');
  });
});

describe('buildSnapshotName', () => {
  it('collapses whitespace and prefixes the console origin', () => {
    expect(buildSnapshotName('  MATCH (v)\n  RETURN   v  ')).toBe('Console: MATCH (v) RETURN v');
  });

  it('truncates long GQL to 60 chars including the ellipsis', () => {
    const name = buildSnapshotName('M'.repeat(100));
    expect(name).toBe(`Console: ${'M'.repeat(57)}...`);
    expect(name.slice('Console: '.length)).toHaveLength(60);
  });

  it('never exceeds the snapshot name cap', () => {
    const name = buildSnapshotName('MATCH (v) RETURN v '.repeat(50));
    expect(name.length).toBeLessThanOrEqual(CONSOLE_SNAPSHOT_NAME_MAX_LENGTH);
    expect(name.endsWith('...')).toBe(true);
  });

  it('keeps the blank-GQL fallback within the snapshot name cap', () => {
    const name = buildSnapshotName('', new Date(2026, 0, 2, 3, 4, 5));
    expect(name.length).toBeLessThanOrEqual(CONSOLE_SNAPSHOT_NAME_MAX_LENGTH);
  });

  it('falls back to the local timestamp when the GQL is blank', () => {
    expect(buildSnapshotName(' \n ', new Date(2026, 0, 2, 3, 4, 5))).toBe('Console Result 2026-01-02 03:04:05');
  });
});

describe('buildHandoffPayload', () => {
  it('serializes the workspace snapshot synchronously', () => {
    const snapshotData = { nodes: [], links: [] } as unknown as SnapshotData;
    const toSnapShotData = vi.fn(() => snapshotData);
    const exportSnapshotTransfer = vi.fn((data: SnapshotData) => ({ version: 'test', nodes: data.nodes }));

    const payload = buildHandoffPayload({
      workspace: { graph: { toSnapShotData } },
      explorerStore: { exportSnapshotTransfer },
      name: 'Console: MATCH (v) RETURN v',
      graph: 'demo',
      graphType: 'demo_type',
      schemaPath: '/schema/demo',
    });

    expect(toSnapShotData).toHaveBeenCalledTimes(1);
    expect(exportSnapshotTransfer).toHaveBeenCalledWith(snapshotData);
    expect(payload).toEqual({
      name: 'Console: MATCH (v) RETURN v',
      graph: 'demo',
      graph_type: 'demo_type',
      schema_path: '/schema/demo',
      data: JSON.stringify({ version: 'test', nodes: [] }),
    });
  });
});
