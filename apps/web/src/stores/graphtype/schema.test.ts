import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeLayoutMap } from '@studio/interfaces';
import type { RootStore } from '@studio/stores';

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

import { INodeTypeItem, type IEdgeTypeItem } from '@studio/interfaces';
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
    store = new SchemaStore({
      commonStore: { userInfo: { ...identity, curSchemaPath: identity.schemaPath } },
      schemaStore: { currentSchema: { path: identity.schemaPath } },
    } as unknown as RootStore);
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
