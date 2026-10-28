import { fetcher, type ConfigType } from './fetcher';
import type {
  IconGroupType,
  IconGroupRecord,
  IconItemRecord,
  SnapshotRecord,
} from '@vesoft-inc/ui-components/contracts';

type SnapshotPage = { total: number; page: number; pageSize: number; items: SnapshotRecord[] };
export const fetchSnapshots = async (
  payload: { page: number; pageSize: number; filter?: string },
  config?: ConfigType
) => {
  const res = config
    ? await fetcher.get<SnapshotPage>('/explorer/snapshots', payload, config)
    : await fetcher.get<SnapshotPage>('/explorer/snapshots', payload);
  return res.data;
};

export const addSnapshot = async (
  payload: {
    name: string;
    graph: string;
    graph_type: string;
    schema_path: string;
    /** Serialized SnapshotPayload; omitted for a new, empty exploration. */
    data?: string;
    thumbnail?: string;
  },
  config?: ConfigType
) => {
  const res = config
    ? await fetcher.post<{ id: string }>('/explorer/snapshots', payload, config)
    : await fetcher.post<{ id: string }>('/explorer/snapshots', payload);
  return res.data;
};

export const deleteSnapshot = async (id: string) => {
  const res = await fetcher.delete(`/explorer/snapshots/${id}`);
  return res.data;
};

export const getSnapshotDetail = async (id: string, config?: ConfigType) => {
  const res = config
    ? await fetcher.get<SnapshotRecord>(`/explorer/snapshots/${id}`, undefined, config)
    : await fetcher.get<SnapshotRecord>(`/explorer/snapshots/${id}`);
  return res.data;
};

export const updateSnapShot = async (snapshot: SnapshotRecord) => {
  const res = await fetcher.put(`/explorer/snapshots/${snapshot.id}`, snapshot);
  return res.data;
};

export const addIconGroup = async (payload: { name: string; type: IconGroupType }) => {
  const res = await fetcher.post<{
    id: string;
  }>('/explorer/icongroup/add', payload);
  return res.data;
};

export const deleteIconGroup = async (id: string) => {
  const res = await fetcher.delete(`/explorer/icongroup/${id}`);
  return res.data;
};

export const getIconGroupList = async (type: IconGroupType) => {
  const res = await fetcher.get<{
    items: IconGroupRecord[];
  }>(`/explorer/icongroup`, {
    type,
  });
  return res.data;
};

export const updateIconGroup = async (payload: { id: string; name: string }) => {
  const res = await fetcher.put(`/explorer/icongroup/${payload.id}`, {
    name: payload.name,
  });
  return res.data;
};

export const addIconGroupItem = async (payload: { groupId: string; name: string; icon: string }) => {
  const { groupId, ...restParams } = payload;
  const res = await fetcher.post<{
    id: string;
  }>(`/explorer/icongroup/${groupId}`, restParams);
  return res.data;
};

export const getIconGroupItemList = async (groupId: string) => {
  const res = await fetcher.get<{
    items: IconItemRecord[];
  }>(`/explorer/icongroup/${groupId}/icons`);
  return res.data;
};

export const deleteIconGroupItem = async (payload: { groupId: string; iconId: string }) => {
  const { groupId, iconId } = payload;
  const res = await fetcher.delete(`/explorer/icongroup/${groupId}/icon/${iconId}`);
  return res.data;
};
