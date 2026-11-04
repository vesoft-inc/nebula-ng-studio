import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { SchemaServices } from '../../services';
import { createQuery, requestConfig, response } from './request';
import { createLayoutSweeper } from './layout';

/**
 * Host configuration and optional capabilities for the Schema service adapter.
 * @public
 */
export interface StudioServerSchemaOptions {
  /** Host Axios client with the Studio Server API prefix, authentication and response/error policy configured. */
  http: AxiosInstance;
  /**
   * Host client for layout-cleanup configuration reads. Deletions use `http`.
   * Error presentation and authentication remain the host's responsibility.
   * @defaultValue `http`
   */
  backgroundHttp?: AxiosInstance;
  /**
   * Enables sample dataset import. Omit to leave the service method unavailable.
   * @defaultValue `false`
   */
  importDataset?: boolean;
  /**
   * Enables best-effort cleanup of saved layouts absent from a Schema's live graph type list.
   * The identity is copied at creation; omit this configuration to disable cleanup.
   */
  layouts?: {
    /** Graphd address used to identify the saved layouts. */
    address: string;
    /** Database username that owns the saved layouts. */
    username: string;
    /**
     * Additional encoded key namespace, for example a tenant/database scope supplied by the host.
     * Must match the editor layout namespace. Omit to retain existing Studio v1 keys; no data is migrated.
     */
    namespace?: string;
  };
}

/**
 * Creates Schema query, session-switching and explicitly enabled optional services.
 *
 * @remarks
 * Creation sends no requests. Cleanup records belong to this service instance and failed passes can retry.
 * Reuse the instance within its identity scope; create a new one when the bound identity changes.
 * Authentication, navigation and error presentation belong to the host.
 * @public
 */
export function createStudioServerSchemaServices({
  http,
  backgroundHttp = http,
  importDataset = false,
  layouts,
}: StudioServerSchemaOptions): SchemaServices {
  return {
    execute: createQuery(http),
    switchSchema: async (schemaPath, options) =>
      response(
        http.post<ServerResponse<object>>('/nebula/changeSchema', { schemaPath }, requestConfig(options)),
        options
      ),
    ...(importDataset
      ? ({
          importDataset: async (dataSet, options) =>
            response(
              http.post<ServerResponse<object>>('/nebula/import-data', { dataSet }, requestConfig(options)),
              options
            ),
        } satisfies Pick<SchemaServices, 'importDataset'>)
      : {}),
    ...(layouts ? { sweepLayouts: createLayoutSweeper(http, backgroundHttp, { ...layouts }) } : {}),
  };
}
