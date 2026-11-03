import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { SchemaServices } from '../../services';
import { createQuery, requestConfig, response } from './request';
import { createLayoutSweeper } from './layout';

export interface StudioServerSchemaOptions {
  http: AxiosInstance;
  /** Host client for background configuration reads. Defaults to http. */
  backgroundHttp?: AxiosInstance;
  importDataset?: boolean;
  layouts?: { address: string; username: string; namespace?: string };
}

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
