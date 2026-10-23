import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeLayoutMap } from '@studio/interfaces';

const globalConfig = vi.hoisted(() => ({
  fetchGlobalConfig: vi.fn(async (_key: string, _config?: unknown): Promise<unknown> => null),
  upsertGlobalConfig: vi.fn(),
  listAllGlobalConfigs: vi.fn(),
  deleteGlobalConfig: vi.fn(),
}));
vi.mock('@studio/services/globalConfig', () => globalConfig);
vi.mock('@studio/services', async () => ({
  ...(await import('@studio/services/schemaLayout')),
  execGql: vi.fn(),
  getSketchById: vi.fn(),
}));
vi.mock('@studio/utils', () => ({ extractEdgeByEdgeTypeName: vi.fn() }));

import { INodeTypeItem, IEdgeTypeItem } from '@studio/interfaces';
import { execGql } from '@studio/services';
import { SCHEMA_LAYOUT_READ_TIMEOUT_MS } from '@studio/services/schemaLayout';
import SchemaStore from './schema';

const identity = {
  address: '127.0.0.1:9669',
  username: 'root',
  schemaPath: '/schema/demo',
  graphTypeName: 'movie_type',
};
const saved: NodeLayoutMap = { A: { x: 10, y: 20 } };

describe('graph type layout restoration', () => {
  let store: SchemaStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    store = new SchemaStore();
    store.attachSession({
      commonStore: { userInfo: { ...identity, curSchemaPath: identity.schemaPath } },
      schemaStore: { currentSchema: { path: identity.schemaPath } },
    });
    store.transformGrapTypeByDDL = vi.fn(
      async (): Promise<[INodeTypeItem[], IEdgeTypeItem[]]> => [[new INodeTypeItem({ name: 'A' })], []]
    );
  });

  afterEach(() => {
    store.disposeReaction();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens with DDL after the optional config read reaches its deadline', async () => {
    let completeRead!: (value: unknown) => void;
    globalConfig.fetchGlobalConfig.mockReturnValueOnce(new Promise((resolve) => (completeRead = resolve)));

    const loaded = store.transformGraphTypeToEditorFromDDL(identity.graphTypeName);
    await vi.advanceTimersByTimeAsync(SCHEMA_LAYOUT_READ_TIMEOUT_MS);
    await loaded;

    expect(store.nodeTypeList.map((node) => node.name)).toEqual(['A']);
    expect(store.savedLayout).toBeNull();
    completeRead({ version: 1, ...identity, nodes: saved });
    await Promise.resolve();
    expect(store.savedLayout).toBeNull();
  });

  it('loads the saved arrangement with the DDL when the config responds promptly', async () => {
    globalConfig.fetchGlobalConfig.mockResolvedValueOnce({ version: 1, ...identity, nodes: saved });

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
      const store = new SchemaStore();
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
