import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeNodePositions } from '@vesoft-inc/ui-components/schema-editor/model';
// Static import for fixtures: the key builder is pure, so it does not need the
// per-test module isolation that the stateful functions under test rely on.
import { schemaLayoutConfigKey, type SchemaLayoutIdentity } from './schemaLayout';

const globalConfig = vi.hoisted(() => ({
  fetchGlobalConfig: vi.fn(async (_key: string, _config?: unknown): Promise<unknown> => null),
  upsertGlobalConfig: vi.fn(async (_key: string, _value: unknown, _config?: unknown) => ({ key: '', value: '' })),
  listAllGlobalConfigs: vi.fn(async (): Promise<{ key: string; value: string | null }[]> => []),
  deleteGlobalConfig: vi.fn(async (_key: string) => undefined),
}));

vi.mock('./globalConfig', () => globalConfig);

const ADDRESS = '127.0.0.1:9669';
const USERNAME = 'root';
const SCHEMA_PATH = '/schema/demo';
const GRAPH_TYPE = 'movie_type';

const IDENTITY = {
  address: ADDRESS,
  username: USERNAME,
  schemaPath: SCHEMA_PATH,
  graphTypeName: GRAPH_TYPE,
};

const CONFIG_KEY = `studio-schema-layout-v1|${ADDRESS}|${USERNAME}|~2fschema~2fdemo|${GRAPH_TYPE}`;
const SAVE_CONFIG = { errTip: false, timeout: 2000 };

const document = (nodes: unknown) => ({ version: 1, ...IDENTITY, nodes });

const loadModule = () => import('./schemaLayout');

describe('schema layout config key', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('composes one readable entry per address, username, schema path and graph type', async () => {
    const { schemaLayoutConfigKey } = await loadModule();

    expect(schemaLayoutConfigKey(IDENTITY)).toBe(CONFIG_KEY);
  });

  it('escapes everything that would break the ":key" path parameter', async () => {
    const { schemaLayoutConfigKey } = await loadModule();
    const key = schemaLayoutConfigKey({
      address: ADDRESS,
      username: 'ro ot',
      schemaPath: '/a/b',
      graphTypeName: 'movie?type#1%2',
    })!;

    // `/` would split the route; `?`, `#` and `%` are not rejected but silently
    // truncated or decoded by the server, so reads and writes would disagree.
    expect(key).not.toMatch(/[/?#% ]/);
    expect(key).toBe('studio-schema-layout-v1|127.0.0.1:9669|ro~20ot|~2fa~2fb|movie~3ftype~231~252');
  });

  it('keeps non-ASCII identifiers short and readable', async () => {
    const { schemaLayoutConfigKey } = await loadModule();

    expect(
      schemaLayoutConfigKey({ address: ADDRESS, username: USERNAME, schemaPath: '/', graphTypeName: '电影类型' })
    ).toBe('studio-schema-layout-v1|127.0.0.1:9669|root|~2f|电影类型');
  });

  it('never composes the same key from different identities', async () => {
    const { schemaLayoutConfigKey } = await loadModule();
    const keys = [
      IDENTITY,
      { ...IDENTITY, graphTypeName: 'other_type' },
      { ...IDENTITY, schemaPath: '/' },
      { ...IDENTITY, username: 'other' },
      { ...IDENTITY, address: '127.0.0.1:9670' },
      // A literal `~2f` in a name must not collide with an escaped `/`.
      { ...IDENTITY, graphTypeName: '~2fmovie' },
      { ...IDENTITY, schemaPath: '~2fschema~2fdemo' },
      // The separator is escaped too.
      { ...IDENTITY, username: 'ro|ot' },
    ].map(schemaLayoutConfigKey);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives up instead of truncating a key that cannot fit the key column', async () => {
    const { schemaLayoutConfigKey } = await loadModule();

    expect(schemaLayoutConfigKey({ ...IDENTITY, graphTypeName: 'x'.repeat(300) })).toBeNull();
  });

  it('refuses to build a key without a full identity', async () => {
    const { schemaLayoutConfigKey } = await loadModule();

    expect(schemaLayoutConfigKey({ ...IDENTITY, address: undefined })).toBeNull();
    expect(schemaLayoutConfigKey({ ...IDENTITY, username: undefined })).toBeNull();
    expect(schemaLayoutConfigKey({ ...IDENTITY, graphTypeName: undefined })).toBeNull();
  });
});

describe('schema layout document', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('resolves the schema path from the first non-empty candidate', async () => {
    const { resolveSchemaPath } = await loadModule();

    expect(resolveSchemaPath(undefined, '', '/schema/demo')).toBe('/schema/demo');
    expect(resolveSchemaPath('/from-session', '/schema/demo')).toBe('/from-session');
    expect(resolveSchemaPath(undefined, undefined)).toBe('');
  });

  it('drops entries that are not finite x/y pairs', async () => {
    const { sanitizeNodeLayoutMap } = await loadModule();

    expect(
      sanitizeNodeLayoutMap({
        A: { x: 1, y: 2 },
        B: { x: '1', y: 2 },
        C: { x: Number.NaN, y: 0 },
        D: { x: 0 },
        E: null,
        '': { x: 0, y: 0 },
      })
    ).toEqual({ A: { x: 1, y: 2 } });
  });

  it('serializes canvas nodes by name and drops unusable entries', async () => {
    expect(
      serializeNodePositions([
        { name: 'A', x: 1, y: 2 },
        { name: '', x: 1, y: 2 },
        { name: 'B', x: Number.NaN, y: 2 },
        { name: 'C', x: 3, y: 4 },
      ])
    ).toEqual({ A: { x: 1, y: 2 }, C: { x: 3, y: 4 } });
  });

  it('degrades to "no layout" for foreign, stale or empty documents', async () => {
    const { parseLayoutDocument } = await loadModule();
    const nodes = { A: { x: 1, y: 2 } };

    expect(parseLayoutDocument(document(nodes), IDENTITY)).toEqual(document(nodes));
    expect(parseLayoutDocument(null, IDENTITY)).toBeNull();
    expect(parseLayoutDocument('not json', IDENTITY)).toBeNull();
    // Another version.
    expect(parseLayoutDocument({ ...document(nodes), version: 99 }, IDENTITY)).toBeNull();
    // A row that belongs to a different graph type: keys cannot collide, so this
    // can only come from a hand-edited value.
    expect(parseLayoutDocument(document(nodes), { ...IDENTITY, graphTypeName: 'other_type' })).toBeNull();
    expect(parseLayoutDocument(document(nodes), { ...IDENTITY, schemaPath: '/' })).toBeNull();
    // Nothing usable inside.
    expect(parseLayoutDocument(document({ A: { x: 'bad', y: 2 } }), IDENTITY)).toBeNull();
    expect(parseLayoutDocument(document({}), IDENTITY)).toBeNull();
  });
});

describe('schema layout persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('reads the entry of the requested graph type and returns its nodes', async () => {
    globalConfig.fetchGlobalConfig.mockResolvedValueOnce(document({ A: { x: 1, y: 2 } }));

    const { readGraphTypeLayout } = await loadModule();
    const layout = await readGraphTypeLayout(IDENTITY);

    expect(globalConfig.fetchGlobalConfig).toHaveBeenCalledWith(CONFIG_KEY, { timeout: 2000 });
    expect(layout).toEqual({ A: { x: 1, y: 2 } });
  });

  it('reads nothing without an identity or without a stored entry', async () => {
    const { readGraphTypeLayout } = await loadModule();

    expect(await readGraphTypeLayout({ ...IDENTITY, username: undefined })).toBeNull();
    expect(globalConfig.fetchGlobalConfig).not.toHaveBeenCalled();

    globalConfig.fetchGlobalConfig.mockResolvedValueOnce(null);
    expect(await readGraphTypeLayout(IDENTITY)).toBeNull();
  });

  it('writes a self-describing document under its own key', async () => {
    const { writeGraphTypeLayout } = await loadModule();
    await writeGraphTypeLayout(IDENTITY, { A: { x: 1, y: 2 } });

    expect(globalConfig.upsertGlobalConfig).toHaveBeenCalledWith(
      CONFIG_KEY,
      document({ A: { x: 1, y: 2 } }),
      SAVE_CONFIG
    );
  });

  it('does not read before writing, so two graph types never share a row', async () => {
    const { writeGraphTypeLayout } = await loadModule();
    await writeGraphTypeLayout(IDENTITY, { A: { x: 1, y: 2 } });

    expect(globalConfig.fetchGlobalConfig).not.toHaveBeenCalled();
  });

  it('skips writes without an identity or with an empty layout', async () => {
    const { writeGraphTypeLayout } = await loadModule();

    await writeGraphTypeLayout({ ...IDENTITY, address: undefined }, { A: { x: 1, y: 2 } });
    await writeGraphTypeLayout(IDENTITY, {});

    expect(globalConfig.upsertGlobalConfig).not.toHaveBeenCalled();
  });

  it('never rejects when the write fails, and keeps accepting later writes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalConfig.upsertGlobalConfig.mockRejectedValueOnce(new Error('database disabled'));

    const { writeGraphTypeLayout } = await loadModule();
    await expect(writeGraphTypeLayout(IDENTITY, { A: { x: 1, y: 2 } })).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();

    await expect(writeGraphTypeLayout(IDENTITY, { A: { x: 9, y: 9 } })).resolves.toBe(true);
    expect(globalConfig.upsertGlobalConfig).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('falls back after a stalled read and ignores a late response', async () => {
    vi.useFakeTimers();
    let completeRead!: (value: unknown) => void;
    globalConfig.fetchGlobalConfig.mockReturnValueOnce(new Promise((resolve) => (completeRead = resolve)));
    const { readGraphTypeLayout, SCHEMA_LAYOUT_READ_TIMEOUT_MS } = await loadModule();

    const read = readGraphTypeLayout(IDENTITY);
    await vi.advanceTimersByTimeAsync(SCHEMA_LAYOUT_READ_TIMEOUT_MS);
    await expect(read).resolves.toBeNull();

    completeRead(document({ A: { x: 1, y: 2 } }));
    await expect(read).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the read deadline after an ordinary successful response', async () => {
    vi.useFakeTimers();
    globalConfig.fetchGlobalConfig.mockResolvedValueOnce(document({ A: { x: 1, y: 2 } }));
    const { readGraphTypeLayout } = await loadModule();

    await expect(readGraphTypeLayout(IDENTITY)).resolves.toEqual({ A: { x: 1, y: 2 } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not confirm an invalid identity or an empty layout as saved', async () => {
    const { writeGraphTypeLayout } = await loadModule();
    await expect(writeGraphTypeLayout({ ...IDENTITY, address: undefined }, { A: { x: 1, y: 2 } })).resolves.toBe(false);
    await expect(writeGraphTypeLayout(IDENTITY, {})).resolves.toBe(false);
  });

  it('serializes overlapping writes so the newest arrangement cannot be overtaken', async () => {
    let completeSave!: () => void;
    globalConfig.upsertGlobalConfig.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeSave = () => resolve({ key: CONFIG_KEY, value: '' });
        })
    );
    const { writeGraphTypeLayout } = await loadModule();

    const first = writeGraphTypeLayout(IDENTITY, { A: { x: 100, y: 200 } });
    const last = writeGraphTypeLayout(IDENTITY, { A: { x: 0, y: 0 } });
    await Promise.resolve();
    expect(globalConfig.upsertGlobalConfig).toHaveBeenCalledTimes(1);
    completeSave();
    await expect(first).resolves.toBe(true);
    await expect(last).resolves.toBe(true);
    expect(globalConfig.upsertGlobalConfig).toHaveBeenLastCalledWith(
      CONFIG_KEY,
      document({ A: { x: 0, y: 0 } }),
      SAVE_CONFIG
    );
  });
});

describe('schema layout migration on rename', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('carries the on-screen arrangement over to the new graph type name', async () => {
    const { migrateGraphTypeLayout } = await loadModule();
    await migrateGraphTypeLayout(IDENTITY, { ...IDENTITY, graphTypeName: 'film_type' }, { A: { x: 1, y: 2 } });

    expect(globalConfig.fetchGlobalConfig).not.toHaveBeenCalled();
    expect(globalConfig.upsertGlobalConfig).toHaveBeenCalledWith(
      'studio-schema-layout-v1|127.0.0.1:9669|root|~2fschema~2fdemo|film_type',
      { version: 1, ...IDENTITY, graphTypeName: 'film_type', nodes: { A: { x: 1, y: 2 } } },
      SAVE_CONFIG
    );
  });

  it('falls back to the stored layout when the canvas is gone', async () => {
    globalConfig.fetchGlobalConfig.mockResolvedValueOnce(document({ A: { x: 1, y: 2 } }));

    const { migrateGraphTypeLayout } = await loadModule();
    await migrateGraphTypeLayout(IDENTITY, { ...IDENTITY, graphTypeName: 'film_type' }, {});

    expect(globalConfig.fetchGlobalConfig).toHaveBeenCalledWith(CONFIG_KEY, { timeout: 2000 });
    expect(globalConfig.upsertGlobalConfig).toHaveBeenCalledWith(
      'studio-schema-layout-v1|127.0.0.1:9669|root|~2fschema~2fdemo|film_type',
      { version: 1, ...IDENTITY, graphTypeName: 'film_type', nodes: { A: { x: 1, y: 2 } } },
      SAVE_CONFIG
    );
  });

  it('does nothing when there is no layout to carry', async () => {
    globalConfig.fetchGlobalConfig.mockResolvedValueOnce(null);

    const { migrateGraphTypeLayout } = await loadModule();
    await migrateGraphTypeLayout(IDENTITY, { ...IDENTITY, graphTypeName: 'film_type' });

    expect(globalConfig.upsertGlobalConfig).not.toHaveBeenCalled();
  });
});

const item = (identity: SchemaLayoutIdentity) => ({
  key: schemaLayoutConfigKey(identity)!,
  value: JSON.stringify({ version: 1, ...identity, nodes: { A: { x: 1, y: 2 } } }),
});

describe('stale layout sweep', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('flags only the entries whose graph type is gone', async () => {
    const { findOrphanLayoutKeys, schemaLayoutKeyPrefix } = await loadModule();
    const scope = { keyPrefix: schemaLayoutKeyPrefix(IDENTITY)!, schemaPath: SCHEMA_PATH };

    const orphans = findOrphanLayoutKeys(
      [
        item(IDENTITY),
        item({ ...IDENTITY, graphTypeName: 'deleted_type' }),
        // Another schema path of the same user, and another user entirely.
        item({ ...IDENTITY, schemaPath: '/', graphTypeName: 'deleted_type' }),
        item({ ...IDENTITY, username: 'someone_else', graphTypeName: 'deleted_type' }),
        // Not ours at all.
        { key: 'explorer-app-config-v1', value: JSON.stringify({ queryTimeout: 1 }) },
      ],
      scope,
      [GRAPH_TYPE]
    );

    expect(orphans).toEqual([schemaLayoutConfigKey({ ...IDENTITY, graphTypeName: 'deleted_type' })]);
  });

  it('never flags an entry it cannot read, so a live layout is not thrown away', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { findOrphanLayoutKeys, schemaLayoutKeyPrefix } = await loadModule();
    const scope = { keyPrefix: schemaLayoutKeyPrefix(IDENTITY)!, schemaPath: SCHEMA_PATH };

    const orphans = findOrphanLayoutKeys(
      [
        { key: `${scope.keyPrefix}broken`, value: 'not json' },
        { key: `${scope.keyPrefix}version`, value: JSON.stringify({ version: 99, schemaPath: SCHEMA_PATH }) },
        { key: `${scope.keyPrefix}empty`, value: null },
      ],
      scope,
      [GRAPH_TYPE]
    );

    expect(orphans).toEqual([]);
    error.mockRestore();
  });

  it('deletes the entries of deleted graph types', async () => {
    globalConfig.listAllGlobalConfigs.mockResolvedValueOnce([
      item(IDENTITY),
      item({ ...IDENTITY, graphTypeName: 'deleted_type' }),
    ]);

    const { sweepStaleGraphTypeLayouts } = await loadModule();
    await sweepStaleGraphTypeLayouts(IDENTITY, [GRAPH_TYPE]);

    expect(globalConfig.deleteGlobalConfig).toHaveBeenCalledTimes(1);
    expect(globalConfig.deleteGlobalConfig).toHaveBeenCalledWith(
      schemaLayoutConfigKey({ ...IDENTITY, graphTypeName: 'deleted_type' })
    );
  });

  it('does not rescan while the live graph types are unchanged', async () => {
    const { sweepStaleGraphTypeLayouts } = await loadModule();

    await sweepStaleGraphTypeLayouts(IDENTITY, [GRAPH_TYPE]);
    await sweepStaleGraphTypeLayouts(IDENTITY, [GRAPH_TYPE]);

    expect(globalConfig.listAllGlobalConfigs).toHaveBeenCalledTimes(1);
  });

  it('rescans when a graph type disappears, or for another scope', async () => {
    const { sweepStaleGraphTypeLayouts } = await loadModule();

    await sweepStaleGraphTypeLayouts(IDENTITY, [GRAPH_TYPE, 'other_type']);
    await sweepStaleGraphTypeLayouts(IDENTITY, [GRAPH_TYPE]);
    await sweepStaleGraphTypeLayouts({ ...IDENTITY, schemaPath: '/' }, [GRAPH_TYPE]);

    expect(globalConfig.listAllGlobalConfigs).toHaveBeenCalledTimes(3);
  });

  it('retries after a failed pass instead of going quiet', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalConfig.listAllGlobalConfigs.mockRejectedValueOnce(new Error('database disabled'));

    const { sweepStaleGraphTypeLayouts } = await loadModule();
    await expect(sweepStaleGraphTypeLayouts(IDENTITY, [GRAPH_TYPE])).resolves.toBeUndefined();
    await sweepStaleGraphTypeLayouts(IDENTITY, [GRAPH_TYPE]);

    expect(warn).toHaveBeenCalled();
    expect(globalConfig.listAllGlobalConfigs).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('does nothing without a full identity', async () => {
    const { sweepStaleGraphTypeLayouts } = await loadModule();

    await sweepStaleGraphTypeLayouts({ schemaPath: SCHEMA_PATH }, [GRAPH_TYPE]);
    await sweepStaleGraphTypeLayouts({ ...IDENTITY, username: undefined }, [GRAPH_TYPE]);

    expect(globalConfig.listAllGlobalConfigs).not.toHaveBeenCalled();
  });
});
