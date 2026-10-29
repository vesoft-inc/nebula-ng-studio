import type { NodeObject } from '@vesoft-inc/force-graph';
import type { GraphItem, GraphTypeElement } from '../schema/types';
import type { GraphRuntimeState } from '../graph/snapshot/types';

/**
 * Node color of a graph's visible nodes together with the node types (tags) painted with it.
 *
 * Colors are keyed by node type (tag), not by graph, so the same tag name in different graphs
 * shares one color, while a graph with several tags shows several colors.
 */
export interface GraphColorUsage {
  color: string;
  /** Node types painted with this color in this graph, most used first. */
  types: string[];
}

/** Console result handoff: graph candidate with its visible node count in the current workspace. */
export interface GraphCandidate {
  graph: string;
  nodeCount: number;
  /** Node colors of this graph's visible nodes, most used first. See `GraphColorUsage`. */
  colors: GraphColorUsage[];
}

/** Serializable payload posted to `POST /api-studio/explorer/snapshots`. */
export interface ConsoleHandoffPayload {
  name: string;
  graph: string;
  graph_type: string;
  schema_path: string;
  data: string;
}

/** Snapshot name prefix, kept untranslated so the origin is searchable in the Explorer list. */
export const CONSOLE_SNAPSHOT_NAME_PREFIX = 'Console: ';
/**
 * Hard cap for the whole snapshot name stored in Explorer
 * (`explorer_snapshots.name` is `varchar(255)`, the cap also keeps the list UI readable).
 */
export const CONSOLE_SNAPSHOT_NAME_MAX_LENGTH = 80;
/** Cap for the GQL snippet embedded in the snapshot name. */
export const CONSOLE_SNAPSHOT_GQL_MAX_LENGTH = 60;

/** Minimal structural view of the Console graph workspace, kept store-free for unit tests. */
type HandoffWorkspace = {
  graph: {
    toSnapShotData: () => GraphRuntimeState;
  };
};

/** Minimal structural view of `ExplorerStore.exportSnapshotTransfer`. */
type HandoffSerializer = {
  exportSnapshotTransfer: (data: GraphRuntimeState) => unknown;
};

/** Graph and node type (tag) of a parsed node; both are `undefined` for malformed node data. */
const getNodeMeta = (node: NodeObject): { graph?: string; type?: string } => {
  const value = (node.data as { value?: { graph?: unknown; type?: unknown } } | undefined)?.value;
  return {
    graph: typeof value?.graph === 'string' ? value.graph : undefined,
    type: typeof value?.type === 'string' && value.type ? value.type : undefined,
  };
};

/** Color painted by the workspace color picker, keyed by the node type (tag) name. */
const getNodeColor = (node: NodeObject): string | undefined => {
  const color = (node as { color?: unknown }).color;
  return typeof color === 'string' && color ? color : undefined;
};

const compareGraphName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Rank graph candidates by the number of nodes visible in the current workspace.
 *
 * - Duplicated `usedGraphs` entries collapse into one candidate.
 * - Candidates with 0 visible nodes are kept (ranked last) so the menu still lists them.
 * - Order: node count desc, then graph name asc for deterministic defaults.
 * - Each candidate also reports the node colors it paints on the canvas (most used first),
 *   together with the node types (tags) each color belongs to.
 */
export const rankGraphCandidates = (usedGraphs: string[], nodes: Iterable<NodeObject>): GraphCandidate[] => {
  const countMap = new Map<string, number>();
  /** Per graph: node color → visible node count and the node types painted with it. */
  const colorUsageMap = new Map<string, Map<string, { count: number; types: Map<string, number> }>>();
  usedGraphs.forEach((graph) => {
    if (!countMap.has(graph)) {
      countMap.set(graph, 0);
      colorUsageMap.set(graph, new Map());
    }
  });

  for (const node of nodes) {
    const { graph, type } = getNodeMeta(node);
    if (!graph || !countMap.has(graph)) continue;
    countMap.set(graph, countMap.get(graph)! + 1);

    const color = getNodeColor(node);
    if (color) {
      const colorUsages = colorUsageMap.get(graph)!;
      const usage = colorUsages.get(color) ?? { count: 0, types: new Map<string, number>() };
      usage.count += 1;
      if (type) {
        usage.types.set(type, (usage.types.get(type) ?? 0) + 1);
      }
      colorUsages.set(color, usage);
    }
  }

  return Array.from(countMap.entries())
    .map(([graph, nodeCount]) => ({
      graph,
      nodeCount,
      // `Map` keeps insertion order, so the sorts stay stable for equally used colors and types.
      colors: Array.from(colorUsageMap.get(graph)!.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .map(([color, usage]) => ({
          color,
          types: Array.from(usage.types.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([type]) => type),
        })),
    }))
    .sort((a, b) => b.nodeCount - a.nodeCount || compareGraphName(a.graph, b.graph));
};

/**
 * Resolve the graph type for a graph through the existing caches.
 *
 * The async `consoleStore.updateGraphTypeMap([graph])` refresh must be awaited by the caller
 * before passing `graphTypeInfo` in.
 */
export const pickGraphType = ({
  graph,
  consoleGraphs,
  graphTypeInfo,
  schemaGraphs,
}: {
  graph: string;
  consoleGraphs: GraphItem[];
  graphTypeInfo: Map<string, GraphTypeElement[]>;
  schemaGraphs: GraphItem[];
}): string | undefined => {
  const fromConsoleGraphs = consoleGraphs.find((item) => item.graph === graph)?.graph_type;
  if (fromConsoleGraphs) return fromConsoleGraphs;

  const fromGraphTypeInfo = graphTypeInfo.get(graph)?.[0]?.graph_type_name;
  if (fromGraphTypeInfo) return fromGraphTypeInfo;

  const fromSchemaGraphs = schemaGraphs.find((item) => item.graph === graph)?.graph_type;
  if (fromSchemaGraphs) return fromSchemaGraphs;

  return undefined;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const formatLocalDateTime = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;

/**
 * Build the Explorer snapshot name from the GQL that produced the graph result.
 *
 * `Console: <single-line GQL>`; the GQL snippet is capped by
 * `CONSOLE_SNAPSHOT_GQL_MAX_LENGTH` and the whole name by `CONSOLE_SNAPSHOT_NAME_MAX_LENGTH`,
 * both truncating with `...`. Falls back to `Console Result <yyyy-MM-dd HH:mm:ss>`
 * when the GQL is blank (the fallback is always shorter than the cap).
 */
export const buildSnapshotName = (gql: string, now: Date = new Date()): string => {
  const singleLine = gql.replace(/\s+/g, ' ').trim();
  if (!singleLine) {
    return `Console Result ${formatLocalDateTime(now)}`;
  }
  const maxSnippetLength = Math.max(
    0,
    Math.min(CONSOLE_SNAPSHOT_GQL_MAX_LENGTH, CONSOLE_SNAPSHOT_NAME_MAX_LENGTH - CONSOLE_SNAPSHOT_NAME_PREFIX.length)
  );
  const snippet =
    singleLine.length > maxSnippetLength ? `${singleLine.slice(0, Math.max(0, maxSnippetLength - 3))}...` : singleLine;
  return `${CONSOLE_SNAPSHOT_NAME_PREFIX}${snippet}`;
};

/**
 * Resolve the `schema_path` a Console-created snapshot must be stored under.
 *
 * Console can run before the schema list is loaded (the Schema panel is lazily mounted), so
 * `schemaStore.currentSchema.path` may be empty while the Explorer list filters by the session's
 * current schema — an empty path would hide the snapshot. Refresh from the server before falling back.
 */
export const ensureSnapshotSchemaPath = async ({
  getPath,
  refresh,
  fallback,
}: {
  getPath: () => string | undefined;
  refresh: () => Promise<void>;
  fallback?: () => string | undefined;
}): Promise<string> => {
  const currentPath = getPath();
  if (currentPath) return currentPath;
  await refresh();
  return getPath() || fallback?.() || '';
};

/**
 * Capture the current workspace state as a snapshot payload.
 *
 * **Must stay synchronous**: after navigation the Console graph workspace is destroyed,
 * so any `await` before this call can capture a destroyed workspace.
 */
export const buildHandoffPayload = ({
  workspace,
  explorerStore,
  name,
  graph,
  graphType,
  schemaPath,
}: {
  workspace: HandoffWorkspace;
  explorerStore: HandoffSerializer;
  name: string;
  graph: string;
  graphType: string;
  schemaPath: string;
}): ConsoleHandoffPayload => {
  const snapshotData = workspace.graph.toSnapShotData();
  const serialized = explorerStore.exportSnapshotTransfer(snapshotData);
  return {
    name,
    graph,
    graph_type: graphType,
    schema_path: schemaPath,
    data: JSON.stringify(serialized),
  };
};
