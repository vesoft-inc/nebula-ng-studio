import type { NodeLayoutMap, NodePosition } from '@studio/interfaces';
import { safeParse } from '@studio/utils/function';
import {
  deleteGlobalConfig,
  fetchGlobalConfig,
  GlobalConfigItem,
  listAllGlobalConfigs,
  upsertGlobalConfig,
} from './globalConfig';

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

type NormalizedIdentity = Required<SchemaLayoutIdentity>;

/**
 * First non-empty candidate wins. The server session path (`userInfo.curSchemaPath`)
 * is preferred over the lazily loaded schema list, which can still be empty when a
 * graph type is opened from a deep link.
 */
export const resolveSchemaPath = (...candidates: (string | undefined)[]): string =>
  candidates.find((path) => !!path) || '';

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

  const key = composeKey([address, username, identity.schemaPath || '', graphTypeName]);
  return key.length <= MAX_CONFIG_KEY_LENGTH ? key : null;
};

/** Prefix shared by every layout entry of one user in one schema path. */
export const schemaLayoutKeyPrefix = (identity: SchemaLayoutIdentity): string | null => {
  const { address, username } = identity;
  if (!address || !username) {
    return null;
  }
  return `${composeKey([address, username, identity.schemaPath || ''])}${SEGMENT_SEPARATOR}`;
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

export { serializeNodePositions } from '@vesoft-inc/ui-components/schema-editor/model';

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

export const readGraphTypeLayout = async (identity: SchemaLayoutIdentity): Promise<NodeLayoutMap | null> => {
  const normalized = normalizeIdentity(identity);
  if (!normalized) {
    return null;
  }
  const key = schemaLayoutConfigKey(normalized);
  if (!key) {
    console.warn('[schema-layout] skipping layout read: config key is too long');
    return null;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bound restoration independently of the HTTP client's timeout, including
    // transports that fail to settle after a connection or proxy stalls.
    const raw = await Promise.race([
      fetchGlobalConfig<unknown>(key, { timeout: SCHEMA_LAYOUT_READ_TIMEOUT_MS }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), SCHEMA_LAYOUT_READ_TIMEOUT_MS);
      }),
    ]);
    return parseLayoutDocument(raw, normalized)?.nodes ?? null;
  } catch (error) {
    console.warn('[schema-layout] failed to read layout', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// Writes are serialized so a debounced save cannot overtake an earlier one.
let pendingWrite: Promise<boolean> = Promise.resolve(true);

export const writeGraphTypeLayout = (identity: SchemaLayoutIdentity, layout: NodeLayoutMap): Promise<boolean> => {
  const normalized = normalizeIdentity(identity);
  const nodes = sanitizeNodeLayoutMap(layout);
  if (!normalized || Object.keys(nodes).length === 0) {
    return Promise.resolve(false);
  }

  const key = schemaLayoutConfigKey(normalized);
  if (!key) {
    console.warn('[schema-layout] skipping layout write: config key is too long');
    return Promise.resolve(false);
  }

  const document: SchemaLayoutDocument = { version: SCHEMA_LAYOUT_VERSION, ...normalized, nodes };
  // The tail of the chain never rejects, so one failed save cannot stall the next.
  pendingWrite = pendingWrite
    .then(() => upsertGlobalConfig(key, document, { errTip: false, timeout: SCHEMA_LAYOUT_READ_TIMEOUT_MS }))
    .then(
      () => true,
      (error) => {
        console.warn('[schema-layout] failed to save layout', error);
        return false;
      }
    );
  return pendingWrite;
};

/**
 * Carry a layout over to a renamed graph type.
 *
 * A rename changes the identity, so the layout becomes a new row; the row of the
 * previous name is left behind as an inert orphan (rows whose graph type no longer
 * exists are never read again). `layout` should be the arrangement currently on
 * screen, which can be newer than what the debounced save has already written.
 */
export const migrateGraphTypeLayout = async (
  from: SchemaLayoutIdentity,
  to: SchemaLayoutIdentity,
  layout?: NodeLayoutMap | null
): Promise<void> => {
  const carried = sanitizeNodeLayoutMap(layout);
  const nodes = Object.keys(carried).length > 0 ? carried : await readGraphTypeLayout(from);
  if (!nodes) {
    return;
  }
  await writeGraphTypeLayout(to, nodes);
};

/**
 * Identity of a stored entry, as far as the sweep needs it. Rows that cannot be
 * read this way are never touched — deleting on a guess would throw away a live
 * arrangement.
 */
const parseStoredIdentity = (
  value: string | null
): Pick<SchemaLayoutDocument, 'schemaPath' | 'graphTypeName'> | null => {
  const document = safeParse<Partial<SchemaLayoutDocument>>(value ?? '');
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

// Last swept generation per scope, so a background sweep does not run on every visit.
const sweptScopes = new Map<string, string>();

/**
 * Drop the entries of graph types that have been deleted.
 *
 * Called with the freshly queried graph types of the current schema path, which is
 * the only live set the client can know; entries under other schema paths are left
 * to the user who owns them. Best effort throughout: a failed pass is retried on
 * the next change and never surfaces to the user.
 *
 * Note that a user who loses the permission to see a graph type also loses the
 * saved arrangement for it — `SHOW GRAPH TYPES` is the only liveness signal there is.
 */
export const sweepStaleGraphTypeLayouts = async (
  identity: SchemaLayoutIdentity,
  liveGraphTypeNames: string[]
): Promise<void> => {
  const { address, username } = identity;
  const schemaPath = identity.schemaPath || '';
  if (!address || !username) {
    return;
  }

  const scopeId = `${address}\u0000${username}\u0000${schemaPath}`;
  const signature = [...liveGraphTypeNames].sort().join('\n');
  if (sweptScopes.get(scopeId) === signature) {
    return;
  }

  const keyPrefix = schemaLayoutKeyPrefix({ address, username, schemaPath });
  if (!keyPrefix) {
    return;
  }

  try {
    const items = await listAllGlobalConfigs();
    const orphans = findOrphanLayoutKeys(items, { keyPrefix, schemaPath }, liveGraphTypeNames);
    await Promise.all(orphans.map((key) => deleteGlobalConfig(key)));
    // Recorded only after a successful pass, so a transient failure is retried.
    sweptScopes.set(scopeId, signature);
  } catch (error) {
    console.warn('[schema-layout] failed to sweep stale layouts', error);
  }
};
