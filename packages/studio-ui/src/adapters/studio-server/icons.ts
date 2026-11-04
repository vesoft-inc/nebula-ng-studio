import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { IconGroupRecord, IconItemRecord } from '../../contracts';
import type { IconServices } from '../../services';
import { requestConfig, response } from './request';

/**
 * Host HTTP configuration for the remote icon catalog service adapter.
 * @public
 */
export interface StudioServerIconOptions {
  /** Host Axios client with the Studio Server API prefix, authentication and response/error policy configured. */
  http: AxiosInstance;
}

/**
 * Creates remote SVG/image group and item services for graph node styles.
 *
 * @remarks
 * Creation sends no requests and does not load a UI or icon catalog.
 * The host binds the client to the appropriate user/database scope and owns error presentation.
 * @public
 */
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
