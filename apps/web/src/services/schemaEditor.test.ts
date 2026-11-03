import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeLayoutMap } from '@vesoft-inc/studio-ui-internal/schema/types';

vi.mock('./nebula', () => ({ execGql: vi.fn() }));
vi.mock('@vesoft-inc/studio-ui-internal/modal', () => ({ modalStore: { message: { error: vi.fn() } } }));

import { INodeTypeItem, IEdgeTypeItem } from '@vesoft-inc/studio-ui-internal/schema/types';
import { execGql } from './nebula';
import { backgroundFetcher } from './fetcher';
import { StudioServerAdapters } from './studioServer';
import { sessionRequests } from './sessionRequests';
import { AxiosHeaders, type AxiosResponse } from 'axios';
const SCHEMA_LAYOUT_READ_TIMEOUT_MS = 2000;
const configResponse = (value: unknown): AxiosResponse => ({
  data: { code: 0, data: { value: JSON.stringify(value) } },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
});
import { SchemaEditorState, serializeNodePositions } from '@vesoft-inc/studio-ui-internal/schema-editor/model';

const identity = {
  address: '127.0.0.1:9669',
  username: 'root',
  schemaPath: '/schema/demo',
  graphTypeName: 'movie_type',
};
const saved: NodeLayoutMap = { A: { x: 10, y: 20 } };

it('serializes canvas positions by entity name and omits unusable coordinates', () => {
  expect(
    serializeNodePositions([
      { name: 'A', x: 1, y: 2 },
      { name: '', x: 1, y: 2 },
      { name: 'B', x: NaN, y: 2 },
      { name: 'C', x: 3, y: 4 },
    ])
  ).toEqual({ A: { x: 1, y: 2 }, C: { x: 3, y: 4 } });
});

describe('graph type layout restoration', () => {
  let store: SchemaEditorState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    store = new SchemaEditorState(new StudioServerAdapters().editor(identity));
    store.transformGrapTypeByDDL = vi.fn(
      async (): Promise<[INodeTypeItem[], IEdgeTypeItem[]]> => [[new INodeTypeItem({ name: 'A' })], []]
    );
  });

  afterEach(() => {
    store.disposeReaction();
    vi.restoreAllMocks();
    vi.useRealTimers();
    sessionRequests.reset();
  });

  it('opens with DDL after the optional config read reaches its deadline', async () => {
    let completeRead!: (value: AxiosResponse) => void;
    vi.spyOn(backgroundFetcher, 'get').mockReturnValueOnce(new Promise((resolve) => (completeRead = resolve)));

    const loaded = store.transformGraphTypeToEditorFromDDL(identity.graphTypeName);
    await vi.advanceTimersByTimeAsync(SCHEMA_LAYOUT_READ_TIMEOUT_MS);
    await loaded;

    expect(store.nodeTypeList.map((node) => node.name)).toEqual(['A']);
    expect(store.savedLayout).toBeNull();
    completeRead(configResponse({ version: 1, ...identity, nodes: saved }));
    await Promise.resolve();
    expect(store.savedLayout).toBeNull();
  });

  it('loads the saved arrangement with the DDL when the config responds promptly', async () => {
    vi.spyOn(backgroundFetcher, 'get').mockResolvedValueOnce(configResponse({ version: 1, ...identity, nodes: saved }));

    await store.transformGraphTypeToEditorFromDDL(identity.graphTypeName);

    expect(store.savedLayout).toEqual(saved);
    expect(store.nodeTypeList.map((node) => node.name)).toEqual(['A']);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('DECIMAL describe metadata', () => {
  it.each(['DECIMAL', 'DECIMAL(12)', 'DECIMAL(256,128)'])(
    'preserves node and edge parameters loaded from %s',
    async (data_type) => {
      const store = new SchemaEditorState({
        execute: execGql,
        layouts: new StudioServerAdapters().editor(identity).layouts,
      });
      store.updateGraphTypeName('payments');
      const node = new INodeTypeItem({ name: 'Payment' });
      const edge = new IEdgeTypeItem({ name: 'Pays', srcNode: node, dstNode: node });
      vi.mocked(execGql).mockResolvedValue({
        code: 0,
        data: {
          tables: [
            { type_name: 'Payment', property_name: 'amount', data_type, primary_key: 'Y', nullable: false },
            { type_name: 'Pays', property_name: 'amount', data_type, multi_edge_key: '', nullable: true },
          ],
        },
      } as never);
      try {
        await store.updateNodeTypeItemProperty([node]);
        await store.updateEdgeTypeItemProperty([edge]);
        const expected = data_type === 'DECIMAL' ? [10, 0] : data_type === 'DECIMAL(12)' ? [12, 0] : [256, 128];
        for (const entity of [node, edge])
          expect([entity.properties[0].decimalPrecision, entity.properties[0].decimalScale]).toEqual(expected);
        expect(node.properties[0].isPrimaryKey).toBe(true);
        expect(edge.properties[0].nullable).toBe(true);
      } finally {
        store.disposeReaction();
        vi.clearAllMocks();
      }
    }
  );
});
