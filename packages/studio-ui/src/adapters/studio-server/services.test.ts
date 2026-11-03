// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { IconGroupType, SnapshotRecord } from '../../contracts';
import {
  createStudioServerConsoleServices,
  createStudioServerSchemaServices,
  createStudioServerSchemaEditorServices,
  createStudioServerExplorerServices,
  createStudioServerIconServices,
} from './index';

function http() {
  const result = (): Promise<{ data: Partial<ServerResponse<object>> }> =>
    Promise.resolve({ data: { code: 0, data: {} } });
  const get = vi.fn((_path: string, _config?: unknown) => result());
  const post = vi.fn((_path: string, _data?: unknown, _config?: unknown) => result());
  const put = vi.fn((_path: string, _data?: unknown, _config?: unknown) => result());
  const del = vi.fn((_path: string, _config?: unknown) => result());
  return { get, post, put, delete: del, client: { get, post, put, delete: del } as unknown as AxiosInstance };
}

describe('Studio Server services', () => {
  it('creates only the requested capabilities without issuing requests', () => {
    const h = http();
    const console = createStudioServerConsoleServices({ http: h.client });
    const schema = createStudioServerSchemaServices({ http: h.client });
    const editor = createStudioServerSchemaEditorServices({ http: h.client });
    const explorer = createStudioServerExplorerServices({ http: h.client });
    createStudioServerIconServices({ http: h.client });
    expect(console.cancelQuery).toBeUndefined();
    expect(console.getSessionId).toBeUndefined();
    expect(schema.importDataset).toBeUndefined();
    expect(schema.sweepLayouts).toBeUndefined();
    expect(editor.sketches).toBeUndefined();
    expect(editor.layouts).toBeUndefined();
    expect(explorer.settings).toBeUndefined();
    expect(h.get).not.toHaveBeenCalled();
    expect(h.post).not.toHaveBeenCalled();
  });

  it('keeps Console execution distinct from metadata queries and preserves millisecond timeouts', async () => {
    const h = http();
    const console = createStudioServerConsoleServices({ http: h.client });
    const { signal } = new AbortController();
    await console.execute('RETURN 1', { signal, queryTimeout: 120000 });
    await console.query('SHOW WARNINGS', { signal, queryTimeout: 2000 });
    expect(h.post.mock.calls).toEqual([
      ['/nebula/console/execGql', { gql: 'RETURN 1', timeout: 120000 }, { signal }],
      ['/gql/exec', { gql: 'SHOW WARNINGS', timeout: 2000 }, { signal }],
    ]);
  });

  it('switches Schema and optionally imports sample data with cancellation', async () => {
    const h = http();
    const schema = createStudioServerSchemaServices({ http: h.client, importDataset: true });
    const { signal } = new AbortController();
    await schema.execute('SHOW SCHEMAS', { signal });
    await schema.switchSchema!('/a-b', { signal });
    await schema.importDataset!('basketball', { signal });
    expect(h.post.mock.calls).toEqual([
      ['/gql/exec', { gql: 'SHOW SCHEMAS', timeout: undefined }, { signal }],
      ['/nebula/changeSchema', { schemaPath: '/a-b' }, { signal }],
      ['/nebula/import-data', { dataSet: 'basketball' }, { signal }],
    ]);
  });

  it('preserves snapshot wire fields, ownership and all CRUD request signals', async () => {
    const h = http();
    const snapshots = createStudioServerExplorerServices({ http: h.client }).snapshots;
    const { signal } = new AbortController();
    const input = {
      name: 'Console result',
      graph: 'g',
      graph_type: 't',
      schema_path: '/a-b',
      data: '{"nodes":[]}',
      thumbnail: 'image',
    };
    const record: SnapshotRecord = {
      id: 'id/with space',
      name: 'n',
      graph: 'g',
      graph_type: 't',
      schemaPath: '/a-b',
      data: input.data,
      created_at: '',
      updated_at: '',
    };
    h.get.mockResolvedValueOnce({ data: { code: 0, data: record } });
    expect(await snapshots.read(record.id, { signal })).toEqual({ code: 0, data: record });
    await snapshots.list({ page: 1, pageSize: 9, filter: '{"schema_path":"/a-b"}' }, { signal });
    await snapshots.create(input, { signal });
    await snapshots.update(record, { signal });
    await snapshots.delete(record.id, { signal });
    expect(h.get.mock.calls).toEqual([
      ['/explorer/snapshots/id%2Fwith%20space', { signal }],
      ['/explorer/snapshots', { params: { page: 1, pageSize: 9, filter: '{"schema_path":"/a-b"}' }, signal }],
    ]);
    expect(h.post).toHaveBeenCalledWith('/explorer/snapshots', input, { signal });
    expect(h.put).toHaveBeenCalledWith('/explorer/snapshots/id%2Fwith%20space', record, { signal });
    expect(h.delete).toHaveBeenCalledWith('/explorer/snapshots/id%2Fwith%20space', { signal });
  });

  it('maps icon operations to canonical endpoints without leaking group IDs into payloads', async () => {
    const h = http();
    const icons = createStudioServerIconServices({ http: h.client });
    const { signal } = new AbortController();
    const type = 'SVG' as IconGroupType;
    await icons.getIconGroupList(type, { signal });
    await icons.getIconGroupItemList('group', { signal });
    await icons.addIconGroup({ name: 'g', type }, { signal });
    await icons.updateIconGroup({ id: 'group', name: 'renamed' }, { signal });
    await icons.deleteIconGroup('group', { signal });
    await icons.addIconGroupItem({ groupId: 'group', name: 'n', icon: 'svg' }, { signal });
    await icons.deleteIconGroupItem({ groupId: 'group', iconId: 'item' }, { signal });
    expect(h.get.mock.calls).toEqual([
      ['/explorer/icongroup', { params: { type }, signal }],
      ['/explorer/icongroup/group/icons', { signal }],
    ]);
    expect(h.post.mock.calls).toEqual([
      ['/explorer/icongroup/add', { name: 'g', type }, { signal }],
      ['/explorer/icongroup/group', { name: 'n', icon: 'svg' }, { signal }],
    ]);
    expect(h.put).toHaveBeenCalledWith('/explorer/icongroup/group', { name: 'renamed' }, { signal });
    expect(h.delete.mock.calls).toEqual([
      ['/explorer/icongroup/group', { signal }],
      ['/explorer/icongroup/group/icon/item', { signal }],
    ]);
  });

  it('forwards Sketch payloads and signals for list, read, create and delete', async () => {
    const h = http();
    const sketches = createStudioServerSchemaEditorServices({ http: h.client, sketches: true }).sketches!;
    const { signal } = new AbortController();
    const sketch = { name: 'draft', schema: '/a', snapshot: '{}' };
    await sketches.list({ keyword: 'draft', page: 1 }, { signal });
    await sketches.read(2, { signal });
    await sketches.create(sketch, { signal });
    await sketches.delete(2, { signal });
    expect(h.get.mock.calls).toEqual([
      ['/sketch/list', { params: { keyword: 'draft', page: 1 }, signal }],
      ['/sketch/2', { signal }],
    ]);
    expect(h.post).toHaveBeenCalledWith('/sketch/create', sketch, { signal });
    expect(h.delete).toHaveBeenCalledWith('/sketch/delete/2', { signal });
  });

  it('keeps business error envelopes and transport rejections intact', async () => {
    const h = http();
    const service = createStudioServerConsoleServices({ http: h.client });
    const failure = { code: 42, message: 'failed', details: 'detail' };
    h.post.mockResolvedValueOnce({ data: failure });
    expect(await service.execute('bad')).toBe(failure);
    const error = new Error('network failed');
    h.post.mockRejectedValueOnce(error);
    await expect(service.query('RETURN 1')).rejects.toBe(error);
  });

  it('rejects cancelled requests before sending and ignores late successful responses', async () => {
    const h = http();
    const service = createStudioServerConsoleServices({ http: h.client });
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(service.execute('RETURN 1', { signal: cancelled.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(h.post).not.toHaveBeenCalled();
    let complete!: (result: { data: Partial<ServerResponse<object>> }) => void;
    h.post.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    const active = new AbortController();
    const pending = service.query('RETURN 2', { signal: active.signal });
    active.abort();
    complete({ data: { code: 0, data: {} } });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('keeps clients isolated', async () => {
    const first = http();
    const second = http();
    const a = createStudioServerConsoleServices({ http: first.client });
    const b = createStudioServerConsoleServices({ http: second.client });
    await a.execute('RETURN 1');
    await b.execute('RETURN 2');
    expect(first.post.mock.calls[0][1]).toMatchObject({ gql: 'RETURN 1' });
    expect(second.post.mock.calls[0][1]).toMatchObject({ gql: 'RETURN 2' });
  });
});
