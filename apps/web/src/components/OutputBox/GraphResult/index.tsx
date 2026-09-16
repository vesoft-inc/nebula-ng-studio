import { GraphDataTable } from '@studio/interfaces/console';
import { useStore } from '@studio/stores';
import { getUsedGraphsFromData } from '@studio/utils/parseData';
import { Box } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { ConsoleResult } from '@vesoft-inc/utils';
import { execGql } from '@studio/services';
import { CommonGraphContent } from '@studio/components/GraphWorkbench/Content';
import { GraphWorkspaceStore } from '@studio/stores/graph/workspace';
import Minimap, {
  MinimapActionButtonGraphLayout,
  MinimapActionButtonZoomIn,
  MinimapActionButtonZoomOut,
} from '@studio/components/GraphWorkbench/Minimap';
import JsonPreview from './JsonPreview';
import PageLoading from '@studio/components/GraphWorkbench/PageLoading';
import { RightSideToolDrawer } from '@studio/components/GraphWorkbench/RightSideTool';
import { readStorageSettings } from '@studio/components/Settings/hook';
import {
  CONSOLE_DEFAULT_LOCAL_SETTINGS,
  GuiSettingIdPrefix,
  StudioSettingIdPrefix,
} from '@studio/components/Settings/constants';
import { isGuiTarget, JSONBig, transformNebulaResult } from '@studio/utils';

interface GraphResultProps {
  result: ConsoleResult<GraphDataTable>;
  onGraphInit?: (forceGraphStoreId: string) => void;
}

function GraphResult(props: GraphResultProps) {
  const { result, onGraphInit } = props;

  const { consoleStore, commonStore } = useStore();
  const [explorerItem, setExplorerItem] = useState<GraphWorkspaceStore | null>(null);

  const usedGraphs = useMemo(() => {
    return getUsedGraphsFromData(result.data?.tables || []);
  }, [result]);

  const settingId = isGuiTarget
    ? `${GuiSettingIdPrefix}`
    : `${StudioSettingIdPrefix}${commonStore.userInfo?.username ?? ''}`;
  const latestLocalSettings = useMemo(() => {
    return {
      ...CONSOLE_DEFAULT_LOCAL_SETTINGS,
      ...readStorageSettings(settingId, { storageInstance: sessionStorage }),
    };
  }, [settingId]);

  const createExplorerItem = async () => {
    await consoleStore.updateGraphTypeMap(usedGraphs);

    const resultId = result.id;
    if (consoleStore.graphWorkspaces.has(resultId)) {
      const item = consoleStore.graphWorkspaces.get(resultId)!;
      setExplorerItem(item);
      return item;
    }
    const explorerItem = new GraphWorkspaceStore({
      stores: {
        modalStore: consoleStore?.rootStore?.modalStore,
      },
      execGql: execGql as ConstructorParameters<typeof GraphWorkspaceStore>[0]['execGql'],
      explorerId: resultId,
    });
    consoleStore.graphWorkspaces.set(resultId, explorerItem);
    setExplorerItem(explorerItem);

    onGraphInit?.(resultId);

    const graphTypes = consoleStore.graphs
      .filter((item) => usedGraphs.includes(item.graph))
      .map((item) => item.graph_type);
    for (const item of [...new Set(graphTypes)]) {
      explorerItem.initGraphTypeDetails(item);
    }

    return explorerItem;
  };

  useEffect(() => {
    let cleanup: () => void;
    createExplorerItem().then((explorerItem) => {
      cleanup = () => {
        explorerItem.graph.destroyGraph();
        explorerItem.destroy();
        if (explorerItem.explorerId) {
          consoleStore.graphWorkspaces.delete(explorerItem.explorerId);
        }
      };
    });
    return () => {
      cleanup?.();
    };
  }, []);

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
