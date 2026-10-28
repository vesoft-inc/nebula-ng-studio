import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { IconGroupType, IconGroupRecord, IconItemRecord } from '../contracts/icons';

export interface IconCatalogService {
  getIconGroupList(type: IconGroupType): Promise<ServerResponse<{ items: IconGroupRecord[] }>>;
  getIconGroupItemList(groupId: string): Promise<ServerResponse<{ items: IconItemRecord[] }>>;
  addIconGroup(values: { name: string; type: IconGroupType }): Promise<ServerResponse<{ id: string }>>;
  updateIconGroup(values: { id: string; name: string }): Promise<ServerResponse<{ id: string }>>;
  deleteIconGroup(id: string): Promise<ServerResponse<{ id: string }>>;
  addIconGroupItem(values: { groupId: string; name: string; icon: string }): Promise<ServerResponse<{ id: string }>>;
  deleteIconGroupItem(values: { groupId: string; iconId: string }): Promise<ServerResponse<{ id: string }>>;
}
