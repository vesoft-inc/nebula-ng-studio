import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { IconGroupRecord, IconItemRecord } from '../../contracts';
import type { IconServices } from '../../services';
import { requestConfig, response } from './request';

export interface StudioServerIconOptions {
  http: AxiosInstance;
}

export function createStudioServerIconServices({ http }: StudioServerIconOptions): IconServices {
  return {
    getIconGroupList: async (type, options) =>
      response(
        http.get<ServerResponse<{ items: IconGroupRecord[] }>>('/explorer/icongroup', {
          params: { type },
          ...requestConfig(options),
        }),
        options
      ),
    getIconGroupItemList: async (id, options) =>
      response(
        http.get<ServerResponse<{ items: IconItemRecord[] }>>(
          `/explorer/icongroup/${encodeURIComponent(id)}/icons`,
          requestConfig(options)
        ),
        options
      ),
    addIconGroup: async (values, options) =>
      response(
        http.post<ServerResponse<{ id: string }>>('/explorer/icongroup/add', values, requestConfig(options)),
        options
      ),
    updateIconGroup: async ({ id, name }, options) =>
      response(
        http.put<ServerResponse<{ id: string }>>(
          `/explorer/icongroup/${encodeURIComponent(id)}`,
          { name },
          requestConfig(options)
        ),
        options
      ),
    deleteIconGroup: async (id, options) =>
      response(
        http.delete<ServerResponse<{ id: string }>>(
          `/explorer/icongroup/${encodeURIComponent(id)}`,
          requestConfig(options)
        ),
        options
      ),
    addIconGroupItem: async ({ groupId, ...values }, options) =>
      response(
        http.post<ServerResponse<{ id: string }>>(
          `/explorer/icongroup/${encodeURIComponent(groupId)}`,
          values,
          requestConfig(options)
        ),
        options
      ),
    deleteIconGroupItem: async ({ groupId, iconId }, options) =>
      response(
        http.delete<ServerResponse<{ id: string }>>(
          `/explorer/icongroup/${encodeURIComponent(groupId)}/icon/${encodeURIComponent(iconId)}`,
          requestConfig(options)
        ),
        options
      ),
  };
}
