import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetcher = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('./fetcher', () => ({ fetcher }));

import { fetchGlobalConfig, listAllGlobalConfigs, upsertGlobalConfig, type GlobalConfigItem } from './globalConfig';

const page = (items: GlobalConfigItem[], total = items.length) => ({
  data: { code: 0, data: { total, page: 1, pageSize: 1000, items } },
});

describe('global config listing', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns a successful empty page', async () => {
    fetcher.get.mockResolvedValueOnce(page([]));
    await expect(listAllGlobalConfigs()).resolves.toEqual([]);
  });

  it('rejects a nonzero API response instead of reporting an empty listing', async () => {
    fetcher.get.mockResolvedValueOnce({ data: { code: 50004001, message: 'database unavailable' } });
    await expect(listAllGlobalConfigs()).rejects.toThrow();
  });

  it('does not return a partial result when a later page fails', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ key: `key-${i}`, value: null }));
    fetcher.get.mockResolvedValueOnce(page(items, 1001));
    fetcher.get.mockResolvedValueOnce({ data: { code: 50004001 } });
    await expect(listAllGlobalConfigs()).rejects.toThrow();
  });

  it('rejects an incomplete listing when the page budget is exhausted', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ key: `key-${i}`, value: null }));
    fetcher.get.mockResolvedValueOnce(page(items, 1001));
    await expect(listAllGlobalConfigs(1)).rejects.toThrow();
  });

  it('rejects a short page that does not cover the advertised total', async () => {
    fetcher.get.mockResolvedValueOnce(page([{ key: 'one-key', value: null }], 2));
    await expect(listAllGlobalConfigs()).rejects.toThrow('Incomplete');
  });

  it('reads all pages before returning the entries', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ key: `key-${i}`, value: null }));
    const last = { key: 'last-key', value: 'value' };
    fetcher.get.mockResolvedValueOnce(page(items, 1001));
    fetcher.get.mockResolvedValueOnce(page([last], 1001));
    await expect(listAllGlobalConfigs()).resolves.toEqual([...items, last]);
  });
});

describe('global config request options', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards a read deadline without enabling error notifications', async () => {
    fetcher.get.mockResolvedValueOnce({ data: { code: 0, data: { value: '{"x":1}' } } });
    await expect(fetchGlobalConfig('layout-key', { timeout: 2000 })).resolves.toEqual({ x: 1 });
    expect(fetcher.get).toHaveBeenCalledWith('/explorer/global-config/layout-key', {
      errTip: false,
      timeout: 2000,
    });
  });

  it('forwards best-effort write options while retaining the failure signal', async () => {
    fetcher.post.mockResolvedValueOnce({ data: { code: 50004001, message: 'database unavailable' } });
    await expect(upsertGlobalConfig('layout-key', { x: 1 }, { errTip: false, timeout: 2000 })).rejects.toThrow(
      'database unavailable'
    );
    expect(fetcher.post).toHaveBeenCalledWith(
      '/explorer/global-config/upsert',
      { key: 'layout-key', value: '{"x":1}' },
      { errTip: false, timeout: 2000 }
    );
  });
});

describe('stale layout sweep API failures', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('retries the same live list after a real nonzero API response', async () => {
    const { schemaLayoutConfigKey, sweepStaleGraphTypeLayouts } = await import('./schemaLayout');
    const identity = { address: '127.0.0.1:9669', username: 'root', schemaPath: '/schema/demo' };
    const deleted = { ...identity, graphTypeName: 'deleted_type' };
    const key = schemaLayoutConfigKey(deleted)!;
    fetcher.get.mockResolvedValueOnce({ data: { code: 50004001 } });
    fetcher.get.mockResolvedValueOnce(
      page([{ key, value: JSON.stringify({ version: 1, ...deleted, nodes: { A: { x: 1, y: 2 } } }) }])
    );
    fetcher.delete.mockResolvedValue({ data: { code: 0 } });

    await sweepStaleGraphTypeLayouts(identity, ['live_type']);
    await sweepStaleGraphTypeLayouts(identity, ['live_type']);

    expect(fetcher.get).toHaveBeenCalledTimes(2);
    expect(fetcher.delete).toHaveBeenCalledWith(`/explorer/global-config/${encodeURIComponent(key)}`);
  });
});
