import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { SnapshotRecord } from '../../contracts';
import type { ExplorerServices, ExplorerSettings, SnapshotPage } from '../../services';
import { createQuery, requestConfig, response } from './request';
import { readConfig, writeConfig } from './config';

/**
 * Host HTTP, version and optional settings configuration for the Explorer service adapter.
 * @public
 */
export interface StudioServerExplorerOptions {
  /** Host Axios client with the Studio Server API prefix, authentication and response/error policy configured. */
  http: AxiosInstance;
  /**
   * Host client for configuration reads. Settings saves use `http`; the host controls error presentation.
   * @defaultValue `http`
   */
  backgroundHttp?: AxiosInstance;
  /** Version stamp used by the UI when exporting snapshots. Supplied by the host; no environment variables are read. */
  snapshotVersion?: string;
  /** Fixed persistence keys copied at creation. Omit to disable remote settings. */
  settings?: {
    /** Application settings key, including any database/tenant scope required by the host. */
    appKey: string;
    /** User settings key bound by the host. Omit for application-only settings without personal configuration requests. */
    personalKey?: string;
  };
}

/**
 * Creates Explorer query, snapshot CRUD and optionally remote settings services.
 *
 * @remarks
 * Creation sends no requests and installs no interceptors. Settings loading returns persisted groups;
 * the UI merges defaults. Replace the service when its bound persistence keys change.
 * Snapshot creation preserves `schema_path`; reads preserve `schemaPath` and serialized snapshot data.
 * The host owns authentication and the Axios policy for HTTP business errors, transport failures and error presentation.
 * @public
 */
export function createStudioServerExplorerServices({
  http,
  backgroundHttp = http,
  snapshotVersion,
  settings,
}: StudioServerExplorerOptions): ExplorerServices {
  const keys = settings ? { ...settings } : undefined;
  return {
    execute: createQuery(http),
    snapshotVersion,
    snapshots: {
      list: async (params, options) =>
        response(
          http.get<ServerResponse<SnapshotPage>>('/explorer/snapshots', { params, ...requestConfig(options) }),
          options
        ),
      create: async (input, options) =>
        response(
          http.post<ServerResponse<{ id: string }>>('/explorer/snapshots', input, requestConfig(options)),
          options
        ),
      read: async (id, options) =>
        response(
          http.get<ServerResponse<SnapshotRecord>>(
            `/explorer/snapshots/${encodeURIComponent(id)}`,
            requestConfig(options)
          ),
          options
        ),
      update: async (snapshot, options) =>
        response(
          http.put<ServerResponse<object>>(
            `/explorer/snapshots/${encodeURIComponent(snapshot.id)}`,
            snapshot,
            requestConfig(options)
          ),
          options
        ),
      delete: async (id, options) =>
        response(
          http.delete<ServerResponse<object>>(`/explorer/snapshots/${encodeURIComponent(id)}`, requestConfig(options)),
          options
        ),
    },
    ...(keys
      ? ({
          settings: {
            load: async (options) => {
              const [app, personal] = await Promise.all([
                readConfig<ExplorerSettings['appConfigForm']>(backgroundHttp, keys.appKey, options),
                keys.personalKey
                  ? readConfig<ExplorerSettings['personalConfigForm']>(backgroundHttp, keys.personalKey, options)
                  : null,
              ]);
              return { ...(app ? { appConfigForm: app } : {}), ...(personal ? { personalConfigForm: personal } : {}) };
            },
            save: async (value, options) => {
              await Promise.all([
                writeConfig(http, keys.appKey, value.appConfigForm, options),
                keys.personalKey ? writeConfig(http, keys.personalKey, value.personalConfigForm, options) : undefined,
              ]);
            },
          },
        } satisfies Pick<ExplorerServices, 'settings'>)
      : {}),
  };
}
