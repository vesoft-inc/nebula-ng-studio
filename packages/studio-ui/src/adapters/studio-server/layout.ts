import type { AxiosInstance } from 'axios';
import { mergeAbortSignals } from '@vesoft-inc/studio-core/request';
import type { NodeLayoutMap, NodePosition, SchemaLayoutServices, SchemaServices } from '../../services';
import { readConfig, writeConfig, listConfigs, deleteConfig, type GlobalConfigItem } from './config';
import { checkAbort } from './request';

/**
 * Persistence for the schema manager visual builder layouts.
 *
 * A layout maps a node type **name** to its canvas position. Names — not the
 * generated item ids — are the stable identity: ids are recreated every time the
 * schema is rebuilt from DDL, while names survive across sessions and DDL edits.
 *
 * One config entry per `(graphd address, username, schema path, graph type)`, so a
 * save only ships the graph type being edited instead of every layout the user
 * owns, and two browser tabs editing different graph types cannot clobber each
 * other's row.
 */

export const SCHEMA_LAYOUT_VERSION = 1;
export const SCHEMA_LAYOUT_CONFIG_PREFIX = 'studio-schema-layout-v1';
export const SCHEMA_LAYOUT_READ_TIMEOUT_MS = 2000;

/** The config `key` column is `varchar(255)`. */
const MAX_CONFIG_KEY_LENGTH = 250;

const SEGMENT_SEPARATOR = '|';
const ESCAPE_CHAR = '~';

/** Guard against pathological payloads; well above any realistic schema size. */
const MAX_LAYOUT_ENTRIES = 20000;

export interface SchemaLayoutIdentity {
  address?: string;
  username?: string;
  schemaPath?: string;
  graphTypeName?: string;
  namespace?: string;
}

/**
 * Stored document. The identity is kept next to the geometry so a row can be
 * traced back to its graph type — and swept up later — without decoding the key.
 */
export interface SchemaLayoutDocument {
  version: number;
  address: string;
  username: string;
  schemaPath: string;
  graphTypeName: string;
  nodes: NodeLayoutMap;
}

type NormalizedIdentity = Required<Omit<SchemaLayoutIdentity, 'namespace'>>;

/**
 * Escape a key segment so the composed key is a single, safe URL path segment.
 *
 * The config route carries the key as a `:key` path parameter, so `/` must go (it
 * would split the route) and `?`, `#` and `%` must go too: those are not rejected
 * by the router, they are silently truncated or decoded, which would make reads and
 * writes disagree about the key. Non-ASCII is left as-is — the server matches the
 * percent-encoded path back to the original characters, and the column counts
 * characters, so CJK identifiers stay short and readable.
 */
export const escapeKeySegment = (value: string): string => {
  let escaped = '';
  for (const char of value) {
    if (/[A-Za-z0-9\-._:!$&'()*+,;=@]/.test(char) || char.charCodeAt(0) > 0x7f) {
      escaped += char;
      continue;
    }
    for (const byte of new TextEncoder().encode(char)) {
      escaped += `${ESCAPE_CHAR}${byte.toString(16).padStart(2, '0')}`;
    }
  }
  return escaped;
};

const composeKey = (segments: string[]): string =>
  [SCHEMA_LAYOUT_CONFIG_PREFIX, ...segments.map(escapeKeySegment)].join(SEGMENT_SEPARATOR);

/**
 * Build the config key of one graph type.
 *
 * Returns `null` when the key cannot fit the `key` column; callers then skip
 * persistence instead of writing a truncated key. The separator and the escape
 * character are escaped inside every segment, so distinct identities can never
 * compose the same key.
 */
export const schemaLayoutConfigKey = (identity: SchemaLayoutIdentity): string | null => {
  const { address, username, graphTypeName } = identity;
  if (!address || !username || !graphTypeName) {
    return null;
  }

  const key = composeKey([
    ...(identity.namespace ? [identity.namespace] : []),
    address,
    username,
    identity.schemaPath || '',
    graphTypeName,
  ]);
  return key.length <= MAX_CONFIG_KEY_LENGTH ? key : null;
};

/** Prefix shared by every layout entry of one user in one schema path. */
export const schemaLayoutKeyPrefix = (identity: SchemaLayoutIdentity): string | null => {
  const { address, username } = identity;
  if (!address || !username) {
    return null;
  }
  return `${composeKey([...(identity.namespace ? [identity.namespace] : []), address, username, identity.schemaPath || ''])}${SEGMENT_SEPARATOR}`;
};

export const isNodePosition = (value: unknown): value is NodePosition => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const { x, y } = value as Partial<NodePosition>;
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y);
};

export const sanitizeNodeLayoutMap = (input: unknown): NodeLayoutMap => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const layout: NodeLayoutMap = {};
  let count = 0;
  for (const [name, position] of Object.entries(input as Record<string, unknown>)) {
    if (!name || !isNodePosition(position)) {
      continue;
    }
    if (count >= MAX_LAYOUT_ENTRIES) {
      break;
    }
    layout[name] = { x: position.x, y: position.y };
    count += 1;
  }
  return layout;
};

const normalizeIdentity = (identity: SchemaLayoutIdentity): NormalizedIdentity | null => {
  const { address, username, graphTypeName } = identity;
  if (!address || !username || !graphTypeName) {
    return null;
  }
  return { address, username, schemaPath: identity.schemaPath || '', graphTypeName };
};

const matchesIdentity = (document: Partial<SchemaLayoutDocument>, identity: NormalizedIdentity) =>
  document.address === identity.address &&
  document.username === identity.username &&
  document.schemaPath === identity.schemaPath &&
  document.graphTypeName === identity.graphTypeName;

/**
 * Tolerant decoder. Anything unexpected — a row belonging to another graph type, a
 * different version, a hand-edited value — degrades to "no saved layout".
 */
export const parseLayoutDocument = (raw: unknown, identity: NormalizedIdentity): SchemaLayoutDocument | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const document = raw as Partial<SchemaLayoutDocument>;
  if (document.version !== SCHEMA_LAYOUT_VERSION || !matchesIdentity(document, identity)) {
    return null;
  }

  const nodes = sanitizeNodeLayoutMap(document.nodes);
  if (Object.keys(nodes).length === 0) {
    return null;
  }
  return { version: SCHEMA_LAYOUT_VERSION, ...identity, nodes };
};

const parseStoredIdentity = (
  value: string | null
): Pick<SchemaLayoutDocument, 'schemaPath' | 'graphTypeName'> | null => {
  let document: Partial<SchemaLayoutDocument> | null;
  try {
    document = JSON.parse(value ?? '') as Partial<SchemaLayoutDocument>;
  } catch {
    return null;
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return null;
  }
  if (document.version !== SCHEMA_LAYOUT_VERSION) {
    return null;
  }
  if (typeof document.schemaPath !== 'string' || typeof document.graphTypeName !== 'string') {
    return null;
  }
  return { schemaPath: document.schemaPath, graphTypeName: document.graphTypeName };
};

/**
 * Entries of one user in one schema path whose graph type no longer exists.
 *
 * The graph type name comes from the stored document rather than from the key, so
 * the judgement never depends on unescaping.
 */
export const findOrphanLayoutKeys = (
  items: GlobalConfigItem[],
  scope: { keyPrefix: string; schemaPath: string },
  liveGraphTypeNames: Iterable<string>
): string[] => {
  const live = new Set(liveGraphTypeNames);

  return items.reduce<string[]>((orphans, item) => {
    if (typeof item.key !== 'string' || !item.key.startsWith(scope.keyPrefix)) {
      return orphans;
    }
    const stored = parseStoredIdentity(item.value);
    if (stored && stored.schemaPath === scope.schemaPath && !live.has(stored.graphTypeName)) {
      orphans.push(item.key);
    }
    return orphans;
  }, []);
};

export function createLayoutServices(http: AxiosInstance, identity: SchemaLayoutIdentity): SchemaLayoutServices {
  const bound = { ...identity };
  let pendingWrite: Promise<void> = Promise.resolve();

  const read: NonNullable<SchemaLayoutServices['read']> = async (graphTypeName, options) => {
    checkAbort(options);
    const normalized = normalizeIdentity({ ...bound, graphTypeName });
    const key = schemaLayoutConfigKey({ ...bound, graphTypeName });
    if (!normalized || !key) return null;
    const deadline = new AbortController();
    const combined = mergeAbortSignals(options?.signal, deadline.signal);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    try {
      const raw = await Promise.race([
        readConfig<unknown>(http, key, { ...options, signal: combined.signal }, SCHEMA_LAYOUT_READ_TIMEOUT_MS),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => {
            resolve(null);
            deadline.abort();
          }, SCHEMA_LAYOUT_READ_TIMEOUT_MS);
        }),
        new Promise<never>((_, reject) => {
          cancel = () => reject(new DOMException('Request aborted', 'AbortError'));
          options?.signal?.addEventListener('abort', cancel, { once: true });
        }),
      ]);
      checkAbort(options);
      return parseLayoutDocument(raw, normalized)?.nodes ?? null;
    } catch (error) {
      checkAbort(options);
      if (error instanceof Error && error.name === 'AbortError' && !deadline.signal.aborted) throw error;
      console.warn('[schema-layout] failed to read layout', error);
      return null;
    } finally {
      clearTimeout(timer);
      if (cancel) options?.signal?.removeEventListener('abort', cancel);
      combined.dispose();
    }
  };

  const write: SchemaLayoutServices['write'] = async (graphTypeName, layout, options) => {
    const request = { ...options };
    const normalized = normalizeIdentity({ ...bound, graphTypeName });
    const key = schemaLayoutConfigKey({ ...bound, graphTypeName });
    const nodes = sanitizeNodeLayoutMap(layout);
    checkAbort(request);
    if (!normalized || !key || Object.keys(nodes).length === 0) return Promise.resolve(false);
    const document: SchemaLayoutDocument = { version: SCHEMA_LAYOUT_VERSION, ...normalized, nodes };
    const saved = pendingWrite.then(async () => {
      checkAbort(request);
      try {
        await writeConfig(http, key, document, request, SCHEMA_LAYOUT_READ_TIMEOUT_MS);
        return true;
      } catch (error) {
        checkAbort(request);
        if (error instanceof Error && error.name === 'AbortError') throw error;
        console.warn('[schema-layout] failed to save layout', error);
        return false;
      }
    });
    // A failed or cancelled save must not block later writes in this instance.
    pendingWrite = saved.then(
      () => {},
      () => {}
    );
    return saved;
  };

  return {
    read,
    write,
    migrate: async (from, to, layout, options) => {
      checkAbort(options);
      const carried = sanitizeNodeLayoutMap(layout);
      const nodes = Object.keys(carried).length > 0 ? carried : await read(from, options);
      checkAbort(options);
      if (nodes) await write(to, nodes, options);
    },
  };
}

export function createLayoutSweeper(
  http: AxiosInstance,
  backgroundHttp: AxiosInstance,
  identity: SchemaLayoutIdentity
): NonNullable<SchemaServices['sweepLayouts']> {
  const bound = { ...identity };
  const sweptScopes = new Map<string, string>();
  return async (schemaPath, liveGraphTypeNames, options) => {
    checkAbort(options);
    const keyPrefix = schemaLayoutKeyPrefix({ ...bound, schemaPath });
    if (!keyPrefix) return;
    const names = [...liveGraphTypeNames];
    const signature = names.sort().join('\n');
    if (sweptScopes.get(keyPrefix) === signature) return;
    try {
      const items = await listConfigs(backgroundHttp, options);
      const orphans = findOrphanLayoutKeys(items, { keyPrefix, schemaPath }, names);
      await Promise.all(orphans.map((key) => deleteConfig(http, key, options)));
      checkAbort(options);
      sweptScopes.set(keyPrefix, signature);
    } catch (error) {
      checkAbort(options);
      if (error instanceof Error && error.name === 'AbortError') throw error;
      console.warn('[schema-layout] failed to sweep stale layouts', error);
    }
  };
}
