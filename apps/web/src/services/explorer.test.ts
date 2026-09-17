import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetcher = vi.hoisted(() => ({
  get: vi.fn(async (_path: string, _params?: unknown) => ({ data: { code: 0, data: {} } })),
  post: vi.fn(async (_path: string, _payload?: unknown) => ({ data: { code: 0, data: {} } })),
  put: vi.fn(async (_path: string, _payload?: unknown) => ({ data: { code: 0, data: {} } })),
  delete: vi.fn(async (_path: string) => ({ data: { code: 0, data: {} } })),
}));

vi.mock('./fetcher', () => ({ fetcher }));

import {
  addIconGroup,
  addIconGroupItem,
  addSnapshot,
  deleteIconGroup,
  deleteIconGroupItem,
  deleteSnapshot,
  fetchSnapshots,
  getIconGroupItemList,
  getIconGroupList,
  getSnapshotDetail,
  updateIconGroup,
  updateSnapShot,
} from './explorer';
import { IconGroupType } from '@studio/utils/explorer/constant';

const snapshotPayload = {
  id: 'snapshot-1',
  name: 'renamed',
  graph: 'demo',
  graph_type: 'demo_type',
  thumbnail: 'thumbnail',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  schemaPath: '/schema/demo',
};

describe('Explorer persistence API paths', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps every Explorer persistence call on a canonical relative path', async () => {
    await fetchSnapshots({ page: 1, pageSize: 9 });
    await addSnapshot({ name: 'snapshot', graph: 'demo', graph_type: 'demo_type', schema_path: '/schema/demo' });
    await getSnapshotDetail('snapshot-1');
    await updateSnapShot(snapshotPayload);
    await deleteSnapshot('snapshot-1');

    await getIconGroupList(IconGroupType.Img);
    await addIconGroup({ name: 'group', type: IconGroupType.SVG });
    await updateIconGroup({ id: 'group-1', name: 'renamed' });
    await deleteIconGroup('group-1');
    await addIconGroupItem({ groupId: 'group-1', name: 'icon', icon: 'data:image/png;base64,dGVzdA==' });
    await getIconGroupItemList('group-1');
    await deleteIconGroupItem({ groupId: 'group-1', iconId: 'icon-1' });

    expect(fetcher.get.mock.calls).toEqual([
      ['/explorer/snapshots', { page: 1, pageSize: 9 }],
      ['/explorer/snapshots/snapshot-1'],
      ['/explorer/icongroup', { type: IconGroupType.Img }],
      ['/explorer/icongroup/group-1/icons'],
    ]);
    expect(fetcher.post.mock.calls).toEqual([
      [
        '/explorer/snapshots',
        { name: 'snapshot', graph: 'demo', graph_type: 'demo_type', schema_path: '/schema/demo' },
      ],
      ['/explorer/icongroup/add', { name: 'group', type: IconGroupType.SVG }],
      ['/explorer/icongroup/group-1', { name: 'icon', icon: 'data:image/png;base64,dGVzdA==' }],
    ]);
    expect(fetcher.put.mock.calls).toEqual([
      ['/explorer/snapshots/snapshot-1', snapshotPayload],
      ['/explorer/icongroup/group-1', { name: 'renamed' }],
    ]);
    expect(fetcher.delete.mock.calls).toEqual([
      ['/explorer/snapshots/snapshot-1'],
      ['/explorer/icongroup/group-1'],
      ['/explorer/icongroup/group-1/icon/icon-1'],
    ]);
  });

  it('passes optional snapshot data, thumbnail and request config to the canonical create route', async () => {
    await addSnapshot(
      {
        name: 'Console: MATCH (v) RETURN v',
        graph: 'demo',
        graph_type: 'demo_type',
        schema_path: '/schema/demo',
        data: '{"nodes":[],"links":[]}',
        thumbnail: 'data:image/png;base64,dGVzdA==',
      },
      { errTip: false }
    );

    expect(fetcher.post).toHaveBeenCalledTimes(1);
    expect(fetcher.post).toHaveBeenCalledWith(
      '/explorer/snapshots',
      {
        name: 'Console: MATCH (v) RETURN v',
        graph: 'demo',
        graph_type: 'demo_type',
        schema_path: '/schema/demo',
        data: '{"nodes":[],"links":[]}',
        thumbnail: 'data:image/png;base64,dGVzdA==',
      },
      { errTip: false }
    );
  });

  it('forwards request config for snapshot detail without changing the canonical path', async () => {
    await getSnapshotDetail('snapshot-1', { errTip: false });

    expect(fetcher.get).toHaveBeenCalledTimes(1);
    expect(fetcher.get).toHaveBeenCalledWith('/explorer/snapshots/snapshot-1', undefined, { errTip: false });
  });

  it('never calls an absolute or legacy Explorer prefix', async () => {
    await fetchSnapshots({ page: 1, pageSize: 9 });
    await deleteSnapshot('snapshot-1');

    const paths = [
      ...fetcher.get.mock.calls,
      ...fetcher.post.mock.calls,
      ...fetcher.put.mock.calls,
      ...fetcher.delete.mock.calls,
    ].map(([path]) => path);

    // Explorer-only persistence must stay relative so the Studio fetcher base URL
    // (`/api-studio`) is the single source of the prefix.
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((path) => path.startsWith('/explorer/'))).toBe(true);
  });
});
