// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { createStudioServerSchemaEditorServices, createStudioServerSchemaServices } from './index';
import {
  schemaLayoutConfigKey,
  schemaLayoutKeyPrefix,
  parseLayoutDocument,
  sanitizeNodeLayoutMap,
  findOrphanLayoutKeys,
  SCHEMA_LAYOUT_READ_TIMEOUT_MS,
} from './layout';

const identity = { address: '127.0.0.1:9669', username: 'root', schemaPath: '/schema/demo' };
const graphType = 'movie_type';
const key = 'studio-schema-layout-v1|127.0.0.1:9669|root|~2fschema~2fdemo|movie_type';
const nodes = { A: { x: 1, y: 2 } };
const document = (name = graphType, layout: Record<string, { x: number; y: number }> = nodes) => ({
  version: 1,
  ...identity,
  graphTypeName: name,
  nodes: layout,
});
const config = (value: unknown) => ({ data: { code: 0, data: { value: JSON.stringify(value) } } });
const item = (name: string, fields = {}) => ({
  key: schemaLayoutConfigKey({ ...identity, graphTypeName: name, ...fields })!,
  value: JSON.stringify({ ...document(name), ...fields }),
});

function fixture() {
  const get = vi.fn(
    async (_path: string, _options?: unknown): Promise<{ data: Partial<ServerResponse<object>> }> => config(null)
  );
  const post = vi.fn(
    async (
      _path: string,
      _payload?: unknown,
      _options?: unknown
    ): Promise<{ data: Partial<ServerResponse<object>> }> => ({ data: { code: 0 } })
  );
  const del = vi.fn(
    async (_path: string, _options?: unknown): Promise<{ data: Partial<ServerResponse<object>> }> => ({
      data: { code: 0 },
    })
  );
  const http = { get, post, delete: del } as unknown as AxiosInstance;
  const layouts = createStudioServerSchemaEditorServices({ http, layouts: identity }).layouts!;
  return { get, post, delete: del, http, layouts };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('layout identity and document compatibility', () => {
  it('retains the existing v1 key and document', () => {
    expect(schemaLayoutConfigKey({ ...identity, graphTypeName: graphType })).toBe(key);
    expect(parseLayoutDocument(document(), { ...identity, graphTypeName: graphType })).toEqual(document());
  });

  it('escapes path delimiters and keeps Unicode names readable without key collisions', () => {
    expect(
      schemaLayoutConfigKey({ ...identity, username: 'ro ot', schemaPath: '/a/b', graphTypeName: 'movie?type#1%2' })
    ).toBe('studio-schema-layout-v1|127.0.0.1:9669|ro~20ot|~2fa~2fb|movie~3ftype~231~252');
    expect(schemaLayoutConfigKey({ ...identity, schemaPath: '/', graphTypeName: '电影类型' })).toMatch(
      /\|~2f\|电影类型$/
    );
    const keys = ['movie', '~2fmovie', '/movie', 'movie|', 'movie~7c'].map((graphTypeName) =>
      schemaLayoutConfigKey({ ...identity, graphTypeName })
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('skips incomplete and oversized identities', () => {
    expect(schemaLayoutConfigKey({ ...identity, graphTypeName: 'x'.repeat(300) })).toBeNull();
    expect(schemaLayoutConfigKey({ ...identity, username: undefined, graphTypeName: graphType })).toBeNull();
    expect(schemaLayoutConfigKey(identity)).toBeNull();
  });

  it('isolates explicit namespaces using the same segment encoding', () => {
    const base = { ...identity, graphTypeName: graphType };
    const first = schemaLayoutConfigKey({ ...base, namespace: 'tenant/a' });
    const second = schemaLayoutConfigKey({ ...base, namespace: 'tenant~2fa' });
    expect(first).toBe('studio-schema-layout-v1|tenant~2fa|127.0.0.1:9669|root|~2fschema~2fdemo|movie_type');
    expect(new Set([key, first, second]).size).toBe(3);
  });

  it('retains only finite named node positions', () => {
    expect(
      sanitizeNodeLayoutMap({
        A: { x: 1, y: 2 },
        B: { x: '1', y: 2 },
        C: { x: NaN, y: 0 },
        D: { x: 0 },
        E: null,
        '': { x: 1, y: 1 },
      })
    ).toEqual(nodes);
  });

  it('rejects foreign identities, versions, malformed and empty documents', () => {
    const own = { ...identity, graphTypeName: graphType };
    for (const value of [
      null,
      'bad',
      { ...document(), version: 99 },
      { ...document(), schemaPath: '/' },
      { ...document(), graphTypeName: 'other' },
      document(graphType, {}),
      document(graphType, { A: { x: NaN, y: 0 } }),
    ])
      expect(parseLayoutDocument(value, own)).toBeNull();
  });
});

describe('layout persistence', () => {
  it('reads its graph type with a bounded request deadline', async () => {
    const f = fixture();
    f.get.mockResolvedValueOnce(config(document()));
    expect(await f.layouts.read(graphType)).toEqual(nodes);
    expect(f.get).toHaveBeenCalledWith(`/explorer/global-config/${encodeURIComponent(key)}`, {
      signal: expect.any(AbortSignal),
      timeout: 2000,
    });
  });

  it('writes directly to its own v1 row and snapshots queued data', async () => {
    const f = fixture();
    const layout = { A: { x: 1, y: 2 } };
    const save = f.layouts.write(graphType, layout);
    layout.A.x = 999;
    expect(await save).toBe(true);
    expect(f.post).toHaveBeenCalledWith(
      '/explorer/global-config/upsert',
      { key, value: JSON.stringify(document()) },
      { signal: undefined, timeout: 2000 }
    );
    expect(f.get).not.toHaveBeenCalled();
  });

  it('does not confirm empty layouts or oversized keys', async () => {
    const f = fixture();
    expect(await f.layouts.write(graphType, {})).toBe(false);
    expect(await f.layouts.write('x'.repeat(300), nodes)).toBe(false);
    expect(f.post).not.toHaveBeenCalled();
  });

  it('returns false for an unconfirmed write and permits a later save', async () => {
    const f = fixture();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    f.post.mockResolvedValueOnce({ data: { code: 42, message: 'disabled' } });
    expect(await f.layouts.write(graphType, nodes)).toBe(false);
    expect(await f.layouts.write(graphType, nodes)).toBe(true);
  });

  it('bounds a stalled read, ignores late responses and clears its timer', async () => {
    vi.useFakeTimers();
    const f = fixture();
    let complete!: (value: { data: Partial<ServerResponse<object>> }) => void;
    f.get.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    const read = f.layouts.read(graphType);
    await vi.advanceTimersByTimeAsync(SCHEMA_LAYOUT_READ_TIMEOUT_MS);
    await expect(read).resolves.toBeNull();
    complete(config(document()));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the deadline after success and degrades an unavailable read', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.get.mockResolvedValueOnce(config(document()));
    expect(await f.layouts.read(graphType)).toEqual(nodes);
    expect(vi.getTimerCount()).toBe(0);
    f.get.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await f.layouts.read(graphType)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a read promptly even if the host transport ignores cancellation', async () => {
    const f = fixture();
    f.get.mockReturnValueOnce(new Promise(() => {}));
    const cancelled = new AbortController();
    const read = f.layouts.read(graphType, { signal: cancelled.signal });
    const rejected = expect(read).rejects.toMatchObject({ name: 'AbortError' });
    cancelled.abort();
    await rejected;
  });

  it('serializes writes in one service while independent services proceed', async () => {
    const f = fixture();
    let complete!: (value: { data: Partial<ServerResponse<object>> }) => void;
    f.post.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    const first = f.layouts.write(graphType, nodes);
    const last = f.layouts.write(graphType, { A: { x: 9, y: 9 } });
    await Promise.resolve();
    expect(f.post).toHaveBeenCalledTimes(1);
    const second = fixture();
    expect(await second.layouts.write(graphType, nodes)).toBe(true);
    complete({ data: { code: 0 } });
    await Promise.all([first, last]);
    expect(f.post.mock.calls[1][1]).toEqual({ key, value: JSON.stringify(document(graphType, { A: { x: 9, y: 9 } })) });
  });

  it('skips a cancelled queued write and accepts later writes', async () => {
    const f = fixture();
    let complete!: (value: { data: Partial<ServerResponse<object>> }) => void;
    f.post.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    const first = f.layouts.write(graphType, nodes);
    const cancelled = new AbortController();
    const queued = f.layouts.write(graphType, nodes, { signal: cancelled.signal });
    const rejected = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    cancelled.abort();
    await Promise.resolve();
    complete({ data: { code: 0 } });
    await first;
    await rejected;
    expect(f.post).toHaveBeenCalledTimes(1);
    expect(await f.layouts.write(graphType, nodes)).toBe(true);
  });

  it('captures identity at construction and keeps namespaced documents compatible', async () => {
    const f = fixture();
    const bound = { ...identity, namespace: 'tenant' };
    const layouts = createStudioServerSchemaEditorServices({ http: f.http, layouts: bound }).layouts!;
    bound.schemaPath = '/other';
    await layouts.write(graphType, nodes);
    expect(f.post.mock.calls[0][1]).toEqual({
      key: schemaLayoutConfigKey({ ...identity, namespace: 'tenant', graphTypeName: graphType }),
      value: JSON.stringify(document()),
    });
  });

  it('carries the on-screen layout on rename and otherwise restores the stored layout', async () => {
    const f = fixture();
    await f.layouts.migrate!(graphType, 'film_type', nodes);
    expect(f.get).not.toHaveBeenCalled();
    expect(f.post.mock.calls[0][1]).toEqual({
      key: schemaLayoutConfigKey({ ...identity, graphTypeName: 'film_type' }),
      value: JSON.stringify(document('film_type')),
    });
    f.get.mockResolvedValueOnce(config(document()));
    await f.layouts.migrate!(graphType, 'film_type', {});
    expect(f.post).toHaveBeenCalledTimes(2);
  });

  it('does not migrate when no layout exists or when the read is cancelled', async () => {
    const f = fixture();
    await f.layouts.migrate!(graphType, 'new', {});
    expect(f.post).not.toHaveBeenCalled();
    const controller = new AbortController();
    f.get.mockImplementationOnce(async () => {
      controller.abort();
      return config(document());
    });
    await expect(f.layouts.migrate!(graphType, 'new', {}, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(f.post).not.toHaveBeenCalled();
  });
});

describe('stale layout cleanup', () => {
  it('selects only readable obsolete entries in its own namespace and Schema', () => {
    const prefix = schemaLayoutKeyPrefix(identity)!;
    const values = [
      item(graphType),
      item('deleted'),
      item('deleted', { schemaPath: '/' }),
      item('deleted', { username: 'other' }),
      item('deleted', { namespace: 'tenant' }),
      { key: prefix + 'bad', value: 'not JSON' },
      { key: prefix + 'old', value: '{"version":99}' },
    ];
    expect(findOrphanLayoutKeys(values, { keyPrefix: prefix, schemaPath: identity.schemaPath }, [graphType])).toEqual([
      item('deleted').key,
    ]);
  });

  it('deletes obsolete rows and rescans only when the live set or Schema changes', async () => {
    const f = fixture();
    f.get.mockResolvedValue({ data: { code: 0, data: { total: 2, items: [item(graphType), item('deleted')] } } });
    const sweep = createStudioServerSchemaServices({ http: f.http, layouts: identity }).sweepLayouts!;
    await sweep(identity.schemaPath, [graphType]);
    await sweep(identity.schemaPath, [graphType]);
    expect(f.get).toHaveBeenCalledTimes(1);
    expect(f.delete).toHaveBeenCalledWith(`/explorer/global-config/${encodeURIComponent(item('deleted').key)}`, {
      signal: undefined,
    });
    await sweep(identity.schemaPath, [graphType, 'new']);
    await sweep('/', [graphType]);
    expect(f.get).toHaveBeenCalledTimes(3);
  });

  it('retries a failed listing or deletion and does not share cleanup records with another service', async () => {
    const f = fixture();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const listing = { data: { code: 0, data: { total: 1, items: [item('deleted')] } } };
    f.get.mockResolvedValue(listing).mockResolvedValueOnce({ data: { code: 42 } });
    f.delete.mockResolvedValueOnce({ data: { code: 42 } });
    const sweep = createStudioServerSchemaServices({ http: f.http, layouts: identity }).sweepLayouts!;
    await sweep(identity.schemaPath, [graphType]);
    await sweep(identity.schemaPath, [graphType]);
    await sweep(identity.schemaPath, [graphType]);
    expect(f.get).toHaveBeenCalledTimes(3);
    const other = createStudioServerSchemaServices({ http: f.http, layouts: identity }).sweepLayouts!;
    await other(identity.schemaPath, [graphType]);
    expect(f.get).toHaveBeenCalledTimes(4);
  });

  it('does not delete or record success after a cancelled listing', async () => {
    const f = fixture();
    const controller = new AbortController();
    f.get.mockImplementationOnce(async () => {
      controller.abort();
      return { data: { code: 0, data: { total: 1, items: [item('deleted')] } } };
    });
    const sweep = createStudioServerSchemaServices({ http: f.http, layouts: identity }).sweepLayouts!;
    await expect(sweep(identity.schemaPath, [], { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(f.delete).not.toHaveBeenCalled();
    f.get.mockResolvedValueOnce({ data: { code: 0, data: { total: 0, items: [] } } });
    await sweep(identity.schemaPath, []);
    expect(f.get).toHaveBeenCalledTimes(2);
  });
});
