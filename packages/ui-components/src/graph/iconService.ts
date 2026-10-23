import type { ServerResponse } from '@vesoft-inc/utils';
import type { IconGroupType } from './constants';
import type { IconGroup, IconItem } from './types/explorer';

export interface IconCatalogService {
  getIconGroupList(type: IconGroupType): Promise<ServerResponse<{ items: IconGroup[] }>>;
  getIconGroupItemList(groupId: string): Promise<ServerResponse<{ items: IconItem[] }>>;
  addIconGroup(values: { name: string; type: IconGroupType }): Promise<ServerResponse<{ id: string }>>;
  updateIconGroup(values: { id: string; name: string }): Promise<ServerResponse<{ id: string }>>;
  deleteIconGroup(id: string): Promise<ServerResponse<{ id: string }>>;
  addIconGroupItem(values: { groupId: string; name: string; icon: string }): Promise<ServerResponse<{ id: string }>>;
  deleteIconGroupItem(values: { groupId: string; iconId: string }): Promise<ServerResponse<{ id: string }>>;
}
