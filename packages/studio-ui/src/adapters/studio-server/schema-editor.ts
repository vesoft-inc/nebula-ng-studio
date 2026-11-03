import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { SchemaEditorServices, SketchPage, SketchRecord } from '../../services';
import { createQuery, requestConfig, response } from './request';
import { createLayoutServices } from './layout';

export interface StudioServerSchemaEditorOptions {
  http: AxiosInstance;
  /** Host client for layout reads and writes. Defaults to http. */
  backgroundHttp?: AxiosInstance;
  sketches?: boolean;
  layouts?: { address: string; username: string; schemaPath: string; namespace?: string };
}

export function createStudioServerSchemaEditorServices({
  http,
  backgroundHttp = http,
  sketches = false,
  layouts,
}: StudioServerSchemaEditorOptions): SchemaEditorServices {
  return {
    execute: createQuery(http),
    ...(layouts ? { layouts: createLayoutServices(backgroundHttp, { ...layouts }) } : {}),
    ...(sketches
      ? ({
          sketches: {
            list: async (params, options) =>
              response(
                http.get<ServerResponse<SketchPage>>('/sketch/list', { params, ...requestConfig(options) }),
                options
              ),
            read: async (id, options) =>
              response(
                http.get<ServerResponse<{ item: SketchRecord }>>(`/sketch/${id}`, requestConfig(options)),
                options
              ),
            create: async (item, options) =>
              response(
                http.post<ServerResponse<{ id: number }>>('/sketch/create', item, requestConfig(options)),
                options
              ),
            delete: async (id, options) =>
              response(http.delete<ServerResponse<number>>(`/sketch/delete/${id}`, requestConfig(options)), options),
          },
        } satisfies Pick<SchemaEditorServices, 'sketches'>)
      : {}),
  };
}
