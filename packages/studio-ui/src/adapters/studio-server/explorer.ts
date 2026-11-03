import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { SnapshotRecord } from '../../contracts';
import type { ExplorerServices, ExplorerSettings, SnapshotPage } from '../../services';
import { createQuery, requestConfig, response } from './request';
import { readConfig, writeConfig } from './config';

export interface StudioServerExplorerOptions {
  http: AxiosInstance;
  /** Host client for configuration reads. Settings saves use http. Defaults to http. */
  backgroundHttp?: AxiosInstance;
  snapshotVersion?: string;
  settings?: { appKey: string; personalKey?: string };
}

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
