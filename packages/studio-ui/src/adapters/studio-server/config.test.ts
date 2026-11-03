// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import { HttpResCode } from '@vesoft-inc/studio-core/contracts';
import { createStudioServerExplorerServices } from './index';
import { readConfig, writeConfig, listConfigs, deleteConfig, type GlobalConfigItem } from './config';

function fixture() {
  const get = vi.fn(async (_path: string, _options?: unknown): Promise<{ data: object }> => ({ data: { code: 0 } }));
  const post = vi.fn(
    async (_path: string, _body?: unknown, _options?: unknown): Promise<{ data: object }> => ({ data: { code: 0 } })
  );
  const del = vi.fn(async (_path: string, _options?: unknown): Promise<{ data: object }> => ({ data: { code: 0 } }));
  const http = { get, post, delete: del } as unknown as AxiosInstance;
  return { get, post, delete: del, http };
}
const page = (items: GlobalConfigItem[], total = items.length) => ({ data: { code: 0, data: { items, total } } });

describe('configuration persistence', () => {
  it('returns a successful empty listing and reads every page', async () => {
    const f = fixture();
    f.get.mockResolvedValueOnce(page([]));
    expect(await listConfigs(f.http)).toEqual([]);
    const items = Array.from({ length: 1000 }, (_, i) => ({ key: String(i), value: null }));
    const last = { key: 'last', value: 'value' };
    f.get.mockResolvedValueOnce(page(items, 1001)).mockResolvedValueOnce(page([last], 1001));
    expect(await listConfigs(f.http)).toEqual([...items, last]);
    expect(f.get.mock.calls[2][1]).toMatchObject({ params: { page: 2, pageSize: 1000 } });
  });

  it('rejects failures, short listings and budget exhaustion instead of returning partial entries', async () => {
    const f = fixture();
    f.get.mockResolvedValueOnce({ data: { code: 42 } });
    await expect(listConfigs(f.http)).rejects.toThrow('Failed');
    f.get.mockResolvedValueOnce(page([{ key: 'one', value: null }], 2));
    await expect(listConfigs(f.http)).rejects.toThrow('Incomplete');
    const items = Array.from({ length: 1000 }, (_, i) => ({ key: String(i), value: null }));
    f.get.mockResolvedValueOnce(page(items, 1001)).mockRejectedValueOnce(new Error('page failed'));
    await expect(listConfigs(f.http)).rejects.toThrow('page failed');
    f.get.mockResolvedValue(page(items, 20001));
    await expect(listConfigs(f.http)).rejects.toThrow('budget');
  });

  it('does not issue another page request after cancellation', async () => {
    const f = fixture();
    const controller = new AbortController();
    f.get.mockImplementationOnce(async () => {
      controller.abort();
      return page(
        Array.from({ length: 1000 }, (_, i) => ({ key: String(i), value: null })),
        1001
      );
    });
    await expect(listConfigs(f.http, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.get).toHaveBeenCalledOnce();
  });

  it('returns null for missing or malformed values and preserves ordinary transport failures', async () => {
    const f = fixture();
    f.get.mockResolvedValueOnce({ data: { code: 42 } });
    expect(await readConfig(f.http, 'key')).toBeNull();
    f.get.mockResolvedValueOnce({ data: { code: 0, data: { value: 'not JSON' } } });
    expect(await readConfig(f.http, 'key')).toBeNull();
    f.get.mockRejectedValueOnce(new Error('offline'));
    await expect(readConfig(f.http, 'key')).rejects.toThrow('offline');
  });

  it('encodes keys, retains write failure signals and tolerates already deleted rows', async () => {
    const f = fixture();
    const { signal } = new AbortController();
    f.get.mockResolvedValueOnce({ data: { code: 0, data: { value: '{"x":1}' } } });
    expect(await readConfig(f.http, 'a/b', { signal }, 2000)).toEqual({ x: 1 });
    expect(f.get).toHaveBeenCalledWith('/explorer/global-config/a%2Fb', { signal, timeout: 2000 });
    f.post.mockResolvedValueOnce({ data: { code: 42, message: 'disabled' } });
    await expect(writeConfig(f.http, 'a/b', { x: 1 }, { signal }, 2000)).rejects.toThrow('disabled');
    expect(f.post).toHaveBeenCalledWith(
      '/explorer/global-config/upsert',
      { key: 'a/b', value: '{"x":1}' },
      { signal, timeout: 2000 }
    );
    await deleteConfig(f.http, 'a/b', { signal });
    expect(f.delete).toHaveBeenCalledWith('/explorer/global-config/a%2Fb', { signal });
    f.delete.mockResolvedValueOnce({ data: { code: HttpResCode.ErrNotFound } });
    await expect(deleteConfig(f.http, 'already-gone', { signal })).resolves.toBeUndefined();
  });
});

describe('Explorer settings', () => {
  it('loads persisted groups through the background client and saves through the regular client', async () => {
    const regular = fixture();
    const background = fixture();
    const keys = { appKey: 'explorer-app-config-v1', personalKey: 'explorer-app-config-v1-root' };
    const explorer = createStudioServerExplorerServices({
      http: regular.http,
      backgroundHttp: background.http,
      settings: keys,
      snapshotVersion: '5.4',
    });
    keys.appKey = 'changed';
    background.get.mockResolvedValueOnce({ data: { code: 0, data: { value: '{"maxRowsLimit":7}' } } });
    background.get.mockResolvedValueOnce({ data: { code: 0, data: { value: '{"highlightNeighborsOnHover":false}' } } });
    const { signal } = new AbortController();
    expect(await explorer.settings!.load({ signal })).toEqual({
      appConfigForm: { maxRowsLimit: 7 },
      personalConfigForm: { highlightNeighborsOnHover: false },
    });
    expect(background.get.mock.calls.map(([url]) => url)).toEqual([
      '/explorer/global-config/explorer-app-config-v1',
      '/explorer/global-config/explorer-app-config-v1-root',
    ]);
    expect(regular.get).not.toHaveBeenCalled();
    const value = {
      appConfigForm: { queryTimeout: 120, maxRowsLimit: 7, maxNeighborsLimit: 100 },
      personalConfigForm: { displayPropertiesOnHover: true, highlightNeighborsOnHover: false },
    };
    await explorer.settings!.save(value, { signal });
    expect(regular.post.mock.calls).toEqual([
      [
        '/explorer/global-config/upsert',
        { key: 'explorer-app-config-v1', value: JSON.stringify(value.appConfigForm) },
        { signal },
      ],
      [
        '/explorer/global-config/upsert',
        { key: 'explorer-app-config-v1-root', value: JSON.stringify(value.personalConfigForm) },
        { signal },
      ],
    ]);
    expect(background.post).not.toHaveBeenCalled();
    expect(explorer.snapshotVersion).toBe('5.4');
  });

  it('omits missing groups and makes no personal request when no key is configured', async () => {
    const f = fixture();
    const settings = createStudioServerExplorerServices({ http: f.http, settings: { appKey: 'app' } }).settings!;
    expect(await settings.load()).toEqual({});
    expect(f.get).toHaveBeenCalledOnce();
  });

  it('does not treat a failed or cancelled settings save as successful', async () => {
    const f = fixture();
    const settings = createStudioServerExplorerServices({ http: f.http, settings: { appKey: 'app' } }).settings!;
    const value = {
      appConfigForm: { queryTimeout: 120, maxRowsLimit: 7, maxNeighborsLimit: 100 },
      personalConfigForm: { displayPropertiesOnHover: true, highlightNeighborsOnHover: false },
    };
    f.post.mockResolvedValueOnce({ data: { code: 42, message: 'disabled' } });
    await expect(settings.save(value)).rejects.toThrow('disabled');
    const controller = new AbortController();
    controller.abort();
    await expect(settings.save(value, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.post).toHaveBeenCalledOnce();
  });
});
