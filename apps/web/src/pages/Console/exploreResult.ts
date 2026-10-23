import { HttpResCode, type ConsoleResult } from '@vesoft-inc/utils';
import type { GraphDataTable } from '@studio/interfaces/console';
import { addSnapshot, getSnapshotDetail } from '@studio/services/explorer';
import { exportSnapshotTransfer } from '@studio/stores/explorer';
import type ConsoleStore from '@studio/stores/console';
import type SchemaStore from '@studio/stores/schema';
import { buildHandoffPayload, buildSnapshotName, ensureSnapshotSchemaPath, pickGraphType } from '@studio/utils/console';

type ExploreResultArgs = {
  result: ConsoleResult<GraphDataTable>;
  graph?: string;
  consoleStore: ConsoleStore;
  schemaStore: SchemaStore;
  schemaPathFallback?: string;
  navigate: (to: string) => void;
  notifyError: (message: string) => void;
  exploreFailedMessage: string;
};

export async function exploreConsoleResult({
  result,
  graph,
  consoleStore,
  schemaStore,
  schemaPathFallback,
  navigate,
  notifyError,
  exploreFailedMessage,
}: ExploreResultArgs) {
  try {
    const existing = consoleStore.getResultSnapshot(result.id);
    if (!existing) {
      const workspace = consoleStore.graphWorkspaces.get(result.id);
      if (!graph || !workspace || workspace.graph.loading || workspace.graph.isEmpty) return;
    }

    let targetGraph = graph;

    if (existing) {
      const detail = await getSnapshotDetail(existing.snapshotId, { errTip: false });
      if (detail?.code === 0 && detail.data) {
        navigate(`/explorer/snapshots/${existing.snapshotId}`);
        return;
      }
      if (detail?.code !== HttpResCode.ErrNotFound) {
        notifyError(detail?.message?.replace(/^\w+::/, '') || exploreFailedMessage);
        return;
      }
      consoleStore.removeResultSnapshot(result.id);
      targetGraph = existing.graph;
    }

    if (!targetGraph) return;
    const graphName = targetGraph;
    const workspace = consoleStore.graphWorkspaces.get(result.id);
    if (!workspace || workspace.graph.loading || workspace.graph.isEmpty) return;

    const resolveGraphType = () =>
      pickGraphType({
        graph: graphName,
        consoleGraphs: consoleStore.graphs,
        graphTypeInfo: consoleStore.graphTypeInfo,
        schemaGraphs: schemaStore.currentSchema?.graphs ?? [],
      });

    const payload = buildHandoffPayload({
      workspace,
      explorerStore: { exportSnapshotTransfer: (data) => exportSnapshotTransfer(data, process.env.VERSION) },
      name: buildSnapshotName(result.gql),
      graph: graphName,
      graphType: resolveGraphType() ?? '',
      schemaPath: schemaStore.currentSchema?.path ?? '',
    });

    let graphType = payload.graph_type;
    if (!graphType) {
      await consoleStore.updateGraphTypeMap([graphName]);
      graphType = resolveGraphType() ?? '';
    }
    if (!graphType) {
      notifyError(exploreFailedMessage);
      return;
    }

    const schemaPath = await ensureSnapshotSchemaPath({
      getPath: () => schemaStore.currentSchema?.path,
      refresh: () => schemaStore.refreshCurrentSchema(),
      fallback: () => schemaPathFallback,
    });

    const res = await addSnapshot({ ...payload, graph_type: graphType, schema_path: schemaPath }, { errTip: false });
    if (res?.code !== 0 || !res.data?.id) {
      notifyError(res?.message?.replace(/^\w+::/, '') || exploreFailedMessage);
      return;
    }
    consoleStore.setResultSnapshot(result.id, { snapshotId: res.data.id, graph: graphName });
    navigate(`/explorer/snapshots/${res.data.id}`);
  } catch (error) {
    notifyError(error instanceof Error && error.message ? error.message : exploreFailedMessage);
  }
}
