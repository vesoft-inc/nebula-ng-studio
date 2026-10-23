import { GraphDataTable } from '../../../graph/types/console';
import { getUsedGraphsFromData } from '../../../graph/parseData';
import { Box } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ConsoleResult } from '@vesoft-inc/utils';
import { CommonGraphContent } from '../../../graph/components/Content/index';
import { useConsoleResultHost } from '../resultHost';
import { GraphWorkspaceStore } from '../../../graph/stores/workspace';
import Minimap, {
  MinimapActionButtonGraphLayout,
  MinimapActionButtonZoomIn,
  MinimapActionButtonZoomOut,
} from '../../../graph/components/Minimap/index';
import JsonPreview from './JsonPreview';
import PageLoading from '../../../graph/components/PageLoading/index';
import { RightSideToolDrawer } from '../../../graph/components/RightSideTool/index';
import { CONSOLE_DEFAULT_LOCAL_SETTINGS } from '../../../shared/Settings/constants';
import { JSONBig, transformNebulaResult } from '../../../shared/utilities';

interface GraphResultProps {
  result: ConsoleResult<GraphDataTable>;
  onGraphInit?: (forceGraphStoreId: string) => void;
}

function GraphResult(props: GraphResultProps) {
  const { result, onGraphInit } = props;
  const host = useConsoleResultHost();

  const [explorerItem, setExplorerItem] = useState<GraphWorkspaceStore | null>(null);

  const usedGraphs = useMemo(() => {
    return getUsedGraphsFromData(result.data?.tables || []);
  }, [result]);

  const latestLocalSettings = { ...CONSOLE_DEFAULT_LOCAL_SETTINGS, ...host.settings };
  const hostRef = useRef(host);
  hostRef.current = host;

  useEffect(() => {
    let cancelled = false;
    let workspace: GraphWorkspaceStore | undefined;
    const currentHost = hostRef.current;
    const initialize = async () => {
      await currentHost.prepareGraphTypes(usedGraphs);
      if (cancelled) return;
      workspace =
        currentHost.getWorkspace(result.id) ??
        new GraphWorkspaceStore({
          stores: { modalStore: currentHost.modalStore },
          execGql: currentHost.execGql,
          explorerId: result.id,
          settings: currentHost.settings,
        });
      currentHost.saveWorkspace(result.id, workspace);
      setExplorerItem(workspace);
      onGraphInit?.(result.id);
      for (const type of new Set(currentHost.graphTypesFor(usedGraphs))) workspace.initGraphTypeDetails(type);
    };
    void initialize().catch((error) => {
      if (!cancelled) currentHost.modalStore.message.error(String(error));
    });
    return () => {
      cancelled = true;
      workspace?.destroy();
      if (workspace && currentHost.getWorkspace(result.id) === workspace) currentHost.deleteWorkspace(result.id);
    };
  }, [result.id]);

  const { nodesSelected = [], linksSelected = [] } = explorerItem?.graph || {};
  const itemForJsonPreview = Array.from(nodesSelected)[0] ?? Array.from(linksSelected)[0];
  const selectedEntityJsonPreviewData = useMemo(() => {
    if (!itemForJsonPreview) {
      return '';
    }
    return JSONBig.stringify(transformNebulaResult(itemForJsonPreview?.data));
  }, [itemForJsonPreview]);

  return (
    <Box m={0} p={0} height="100%" position="relative">
      {explorerItem && (
        <CommonGraphContent
          explorerItem={explorerItem}
          onInitGraph={async (hooks) => {
            const graph = hooks.initGraph({
              disabledDoubleClickLink: true,
              disableDoubleClickNode: true,
              disableLinkHover: true,
              disableNodeHover: true,
              disableHighlightNeighborsOnHover: false,
            });

            const brushSelect = hooks.addBrushSelect();
            // const destroyTooltip = hooks.addTooltip();

            // Hotkeys should only work on the own graph container.
            let clearup4Shortcuts: () => void = () => null;
            const containerFocusFn = () => {
              const removeShortcuts = hooks.addShortcuts(explorerItem, {
                undo: false,
                redo: false,
                delete: false,
                enter: false,
              });
              clearup4Shortcuts = removeShortcuts;
            };
            const containerBlurFn = () => {
              clearup4Shortcuts();
            };
            explorerItem.graph.graphContainer?.addEventListener('mouseenter', containerFocusFn);
            explorerItem.graph.graphContainer?.addEventListener('mouseleave', containerBlurFn);

            hooks.addCleanup(() => {
              brushSelect.destroy();
              // destroyTooltip();
              clearup4Shortcuts();

              explorerItem.graph.graphContainer?.removeEventListener('mouseenter', containerFocusFn);
              explorerItem.graph.graphContainer?.removeEventListener('mouseleave', containerBlurFn);
            });

            const data = graph.parseSubGraph(result.data?.tables || [], explorerItem.nodeTypePrimaryKeysMap, {
              maxNodesLimit: latestLocalSettings.maxNodesLimit4Graph,
            });
            await explorerItem.graph.getExploreInfo({ data });
          }}
          sx={{
            border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider1}`,
          }}
        >
          {/* <Tooltip explorerItem={explorerItem} /> */}
          <Minimap explorerItem={explorerItem}>
            {({ Wrapper, minimapToggleButton }) => (
              <Wrapper>
                <MinimapActionButtonGraphLayout explorerItem={explorerItem} />
                <MinimapActionButtonZoomIn explorerItem={explorerItem} />
                <MinimapActionButtonZoomOut explorerItem={explorerItem} />
                {minimapToggleButton}
              </Wrapper>
            )}
          </Minimap>
          {/* <ContextMenu explorerItem={explorerItem} /> */}
          <RightSideToolDrawer explorerItem={explorerItem} />
        </CommonGraphContent>
      )}
      {selectedEntityJsonPreviewData && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '8px 0 0 0',
            border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider1}`,
            backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
            overflow: 'auto',
            zIndex: (theme) => theme.zIndex.drawer - 1,
          }}
        >
          <JsonPreview data={selectedEntityJsonPreviewData} />
        </Box>
      )}
      {explorerItem?.graph.loading && (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          zIndex={(theme) => theme.zIndex.drawer + 10}
        >
          <PageLoading logo />
        </Box>
      )}
    </Box>
  );
}

const observedGraphResult = observer(GraphResult);

export default observedGraphResult;
