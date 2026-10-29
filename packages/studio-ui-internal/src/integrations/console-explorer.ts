import { HttpResCode } from '@vesoft-inc/studio-core/contracts';
import { type ConsoleResult } from '../console/types';
import type ConsoleController from '../console/ConsoleController';
import { buildHandoffPayload, buildSnapshotName, ensureSnapshotSchemaPath, pickGraphType } from '../console/handoff';
import type SchemaController from '../schema/SchemaController';
import type { SnapshotServices } from '../explorer/services';
import { exportSnapshotTransfer } from '../explorer/snapshotTransfer';

export interface ConsoleExplorerOptions {
  result: Pick<ConsoleResult, 'id' | 'gql'>;
  graph?: string;
  consoleController: ConsoleController;
  schemaController: SchemaController;
  snapshots: Pick<SnapshotServices, 'read' | 'create'>;
  snapshotVersion?: string;
  schemaPathFallback?: string;
}

/**
 * Reuse or create the Explorer snapshot for a Console result, without navigating or presenting errors.
 * Returns null when no explorable graph is available. Errors without server detail have an empty message
 * so the host can supply a localized fallback. The host owns controller and service lifetimes.
 */
export async function ensureExplorerSnapshot({
  result,
  graph,
  consoleController,
  schemaController,
  snapshots,
  snapshotVersion,
  schemaPathFallback,
}: ConsoleExplorerOptions): Promise<{ snapshotId: string } | null> {
  const existing = consoleController.getResultSnapshot(result.id);
  let targetGraph = graph;

  if (existing) {
    const detail = await snapshots.read(existing.snapshotId);
    if (detail?.code === 0 && detail.data) return { snapshotId: existing.snapshotId };
    if (detail?.code !== HttpResCode.ErrNotFound) {
      throw new Error(detail?.message?.replace(/^\w+::/, '') || '');
    }
    consoleController.removeResultSnapshot(result.id);
    targetGraph = existing.graph;
  }

  if (!targetGraph) return null;
  const graphName = targetGraph;
  const workspace = consoleController.graphWorkspaces.get(result.id);
  if (!workspace || workspace.graph.loading || workspace.graph.isEmpty) return null;

  const resolveGraphType = () =>
    pickGraphType({
      graph: graphName,
      consoleGraphs: consoleController.graphs,
      graphTypeInfo: consoleController.graphTypeInfo,
      schemaGraphs: schemaController.currentSchema.graphs,
    });

  // Capture before awaiting metadata: the host may dispose the live workspace while requests run.
  const payload = buildHandoffPayload({
    workspace,
    explorerStore: { exportSnapshotTransfer: (data) => exportSnapshotTransfer(data, snapshotVersion) },
    name: buildSnapshotName(result.gql),
    graph: graphName,
    graphType: resolveGraphType() ?? '',
    schemaPath: schemaController.currentSchema.path,
  });

  let graphType = payload.graph_type;
  if (!graphType) {
    await consoleController.updateGraphTypeMap([graphName]);
    graphType = resolveGraphType() ?? '';
  }
  if (!graphType) throw new Error();

  const schemaPath = await ensureSnapshotSchemaPath({
    getPath: () => schemaController.currentSchema.path,
    refresh: () => schemaController.refreshCurrentSchema(),
    fallback: () => schemaPathFallback,
  });

  const response = await snapshots.create({ ...payload, graph_type: graphType, schema_path: schemaPath });
  if (response?.code !== 0 || !response.data?.id) {
    throw new Error(response?.message?.replace(/^\w+::/, '') || '');
  }
  consoleController.setResultSnapshot(result.id, { snapshotId: response.data.id, graph: graphName });
  return { snapshotId: response.data.id };
}
