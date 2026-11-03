import type { AxiosInstance } from 'axios';
import { HttpResCode, HTTP_CANCEL_CODE, type ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { QueryOptions } from '../../services';
import { requestConfig, response } from './request';

export interface GlobalConfigItem {
  key: string;
  value: string | null;
}

function checkResult(result: ServerResponse<unknown>) {
  if (result.code === HTTP_CANCEL_CODE) throw new DOMException('Request aborted', 'AbortError');
}

export async function readConfig<T>(
  http: AxiosInstance,
  key: string,
  options?: QueryOptions,
  timeout?: number
): Promise<T | null> {
  const result = await response(
    http.get<ServerResponse<GlobalConfigItem>>(`/explorer/global-config/${encodeURIComponent(key)}`, {
      ...requestConfig(options),
      ...(timeout === undefined ? {} : { timeout }),
    }),
    options
  );
  checkResult(result);
  if (result.code !== 0) return null;
  try {
    return JSON.parse(result.data?.value ?? '') as T;
  } catch {
    return null;
  }
}

export async function writeConfig(
  http: AxiosInstance,
  key: string,
  value: unknown,
  options?: QueryOptions,
  timeout?: number
): Promise<void> {
  const result = await response(
    http.post<ServerResponse<GlobalConfigItem>>(
      '/explorer/global-config/upsert',
      { key, value: JSON.stringify(value) },
      {
        ...requestConfig(options),
        ...(timeout === undefined ? {} : { timeout }),
      }
    ),
    options
  );
  checkResult(result);
  if (result.code !== 0) throw new Error(result.message);
}

export async function listConfigs(http: AxiosInstance, options?: QueryOptions): Promise<GlobalConfigItem[]> {
  const items: GlobalConfigItem[] = [];
  const pageSize = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const result = await response(
      http.get<ServerResponse<{ items: GlobalConfigItem[]; total: number }>>('/explorer/global-config', {
        params: { page, pageSize },
        ...requestConfig(options),
      }),
      options
    );
    checkResult(result);
    if (result.code !== 0 || !Array.isArray(result.data?.items) || !Number.isFinite(result.data.total))
      throw new Error('Failed to list global configs');
    items.push(...result.data.items);
    if (items.length >= result.data.total) return items;
    if (result.data.items.length < pageSize) throw new Error('Incomplete global config listing');
  }
  throw new Error('Global config listing exceeded its page budget');
}

export async function deleteConfig(http: AxiosInstance, key: string, options?: QueryOptions): Promise<void> {
  const result = await response(
    http.delete<ServerResponse<object>>(`/explorer/global-config/${encodeURIComponent(key)}`, requestConfig(options)),
    options
  );
  checkResult(result);
  if (result.code !== 0 && result.code !== HttpResCode.ErrNotFound) throw new Error(result.message);
}
