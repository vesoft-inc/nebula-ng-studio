import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { SchemaEditorServices, SketchPage, SketchRecord } from '../../services';
import { createQuery, requestConfig, response } from './request';
import { createLayoutServices } from './layout';

/**
 * Host configuration and optional persistence for the Schema editor service adapter.
 * @public
 */
export interface StudioServerSchemaEditorOptions {
  /** Host Axios client with the Studio Server API prefix, authentication and response/error policy configured. */
  http: AxiosInstance;
  /**
   * Host client for layout reads and writes; the host controls its error presentation.
   * @defaultValue `http`
   */
  backgroundHttp?: AxiosInstance;
  /**
   * Enables Sketch list/read/create/delete services. Omit to leave them unavailable.
   * @defaultValue `false`
   */
  sketches?: boolean;
  /** Fixed identity copied at creation. Omit to disable layout persistence. */
  layouts?: {
    /** Graphd address used to identify the saved layouts. */
    address: string;
    /** Database username that owns the saved layouts. */
    username: string;
    /** Schema path whose graph type layouts are read and written. */
    schemaPath: string;
    /**
     * Additional encoded key namespace supplied by the host; use the same value for Schema layout cleanup.
     * Omit to retain existing Studio v1 keys and document format; no data is migrated.
     */
    namespace?: string;
  };
}

/**
 * Creates editor query services and explicitly enabled Sketch/layout persistence.
 *
 * @remarks
 * Creation sends no requests. Layout reads wait at most two seconds; ordinary read failures return `null`.
 * Layout writes are serialized within this instance and return `false` when not saved; cancellation rejects.
 * Reuse the instance across pages to retain its queue, and replace it when the bound identity changes.
 * Cross-instance and cross-client write ordering requires server support.
 * @public
 */
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
