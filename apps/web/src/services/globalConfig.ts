import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { HttpResCode } from '@vesoft-inc/studio-core/contracts';
import { safeParse } from '@studio/utils/function';
import { fetcher, type ConfigType } from './fetcher';

/**
 * Generic key/value client for the Studio Server global config store
 * (`explorer_global_configs` table exposed under `/api-studio/explorer/global-config`).
 *
 * The key is the only namespace: callers are expected to prefix it with a
 * feature/version marker plus whatever identity the value belongs to
 * (for example `-<address>-<username>`). Values are stored as JSON strings.
 */

export interface GlobalConfigItem {
  key: string;
  value: string | null;
}

/**
 * Read a config entry. Returns `null` when the entry does not exist, when the
 * request fails, or when the stored value cannot be parsed.
 */
export const fetchGlobalConfig = async <T>(key: string, config?: ConfigType): Promise<T | null> => {
  const res = await fetcher
    .get<ServerResponse<GlobalConfigItem>>(`/explorer/global-config/${encodeURIComponent(key)}`, {
      errTip: false,
      ...config,
    })
    .then((res) => res.data);

  if (res.code !== 0) {
    return null;
  }
  return safeParse<T>(res.data?.value ?? '') ?? null;
};

/**
 * Create or replace a config entry. Rejects when the server does not confirm the write.
 */
export const upsertGlobalConfig = async <T>(
  key: string,
  value: T,
  config?: ConfigType
): Promise<GlobalConfigItem | undefined> => {
  const res = await fetcher
    .post<ServerResponse<GlobalConfigItem>>(
      '/explorer/global-config/upsert',
      {
        key,
        value: JSON.stringify(value),
      },
      config
    )
    .then((res) => res.data);

  if (res.code !== 0) {
    throw new Error(res.message);
  }
  return res.data ?? undefined;
};

export interface GlobalConfigList {
  total: number;
  page: number;
  pageSize: number;
  items: GlobalConfigItem[];
}

const CONFIG_PAGE_SIZE = 1000;

export const listGlobalConfigs = async (
  page: number,
  pageSize = CONFIG_PAGE_SIZE
): Promise<GlobalConfigList | null> => {
  const res = await fetcher
    .get<
      ServerResponse<GlobalConfigList>
    >('/explorer/global-config', { params: { page, pageSize }, ...{ errTip: false } })
    .then((res) => res.data);

  return res.code === 0 ? (res.data ?? null) : null;
};

/**
 * Every stored entry, page by page. Bounded by `maxPages` so a large config table
 * cannot turn a background sweep into an unbounded loop. Incomplete or failed
 * listings reject so callers cannot mistake a failed sweep for a completed one.
 */
export const listAllGlobalConfigs = async (maxPages = 20): Promise<GlobalConfigItem[]> => {
  const items: GlobalConfigItem[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listGlobalConfigs(page);
    if (!result || !Array.isArray(result.items) || !Number.isFinite(result.total)) {
      throw new Error('Failed to list global configs');
    }
    const pageItems = result.items;
    items.push(...pageItems);
    if (items.length >= result.total) {
      return items;
    }
    if (pageItems.length < CONFIG_PAGE_SIZE) {
      throw new Error('Incomplete global config listing');
    }
  }
  throw new Error('Global config listing exceeded its page budget');
};

/** Idempotent: an entry that is already gone is not an error. */
export const deleteGlobalConfig = async (key: string): Promise<void> => {
  const res = await fetcher
    .delete<ServerResponse>(`/explorer/global-config/${encodeURIComponent(key)}`)
    .then((res) => res.data);

  if (res.code !== 0 && res.code !== HttpResCode.ErrNotFound) {
    throw new Error(res.message);
  }
};
