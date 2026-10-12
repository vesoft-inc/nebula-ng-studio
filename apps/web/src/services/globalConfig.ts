import { HttpResCode } from '@vesoft-inc/utils';
import { safeParse } from '@studio/utils/function';
import { fetcher } from './fetcher';

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
export const fetchGlobalConfig = async <T>(key: string): Promise<T | null> => {
  const res = await fetcher
    .get<GlobalConfigItem>(`/explorer/global-config/${encodeURIComponent(key)}`, undefined, { errTip: false })
    .then((res) => res.data);

  if (res.code !== 0) {
    return null;
  }
  return safeParse<T>(res.data?.value ?? '') ?? null;
};

/**
 * Create or replace a config entry. Rejects when the server does not confirm the write.
 */
export const upsertGlobalConfig = async <T>(key: string, value: T): Promise<GlobalConfigItem | undefined> => {
  const res = await fetcher
    .post<GlobalConfigItem>('/explorer/global-config/upsert', {
      key,
      value: JSON.stringify(value),
    })
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
    .get<GlobalConfigList>('/explorer/global-config', { page, pageSize }, { errTip: false })
    .then((res) => res.data);

  return res.code === 0 ? (res.data ?? null) : null;
};

/**
 * Every stored entry, page by page. Bounded by `maxPages` so a large config table
 * cannot turn a background sweep into an unbounded loop.
 */
export const listAllGlobalConfigs = async (maxPages = 20): Promise<GlobalConfigItem[]> => {
  const items: GlobalConfigItem[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listGlobalConfigs(page);
    if (!result) {
      break;
    }
    const pageItems = result.items || [];
    items.push(...pageItems);
    if (pageItems.length < CONFIG_PAGE_SIZE || items.length >= result.total) {
      break;
    }
  }
  return items;
};

/** Idempotent: an entry that is already gone is not an error. */
export const deleteGlobalConfig = async (key: string): Promise<void> => {
  const res = await fetcher.delete(`/explorer/global-config/${encodeURIComponent(key)}`).then((res) => res.data);

  if (res.code !== 0 && res.code !== HttpResCode.ErrNotFound) {
    throw new Error(res.message);
  }
};
