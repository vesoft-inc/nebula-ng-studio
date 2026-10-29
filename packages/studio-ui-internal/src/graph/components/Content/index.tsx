import { useTranslation } from 'react-i18next';
import { PropsWithChildren, useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import Box from '@mui/material/Box';
import type { NodeObject } from '@vesoft-inc/force-graph';
import { BrushSelect } from '../../utils/base/brush-select';
import { addCanvasShortcut } from '../../utils/base/shortcut';
import { initTooltip } from '../GraphTooltip/index';
import { veEditorBackCls, veEditorBackGridCls } from './styles';
import { fullScreenCls } from '../../utils/helpers';
import { GraphStore } from '../../stores/graph';
import { SxProps, Theme, useTheme } from '@mui/material';
import type { GraphWorkspaceStore } from '../../stores/workspace';

export const CommonGraphContent = observer(function ({
  explorerItem,
  onInitGraph,
  children,
  sx,
}: PropsWithChildren<{
  explorerItem: GraphWorkspaceStore;
  /**
   * @description Customize the graph initialization process, you know what you are doing before using this hook.
   * @param arg0 Feel free to call hooks on your own, but do not lost cleanup functions
   * @example
   * ```tsx
   * // Default implementation
   * onInitGraph={({ initGraph, addTooltip, addBrushSelect, addShortcuts, addCleanup }) => {
   *   const graph =initGraph();
   *   const destroyTooltip = addTooltip();
   *   const brushSelect = addBrushSelect();
   *   const removeShortcuts = addShortcuts(explorerItem);
   *   addCleanup(() => {
   *     destroyTooltip();
   *     brushSelect.destroy();
   *     removeShortcuts();
   *     graph.twoGraph?.destroy();
   *     graph.destroyGraph();
   *   });
   * }}
   * ```
   */
  onInitGraph: ({
    initGraph,
    addTooltip,
    addBrushSelect,
    addShortcuts,
    addCleanup,
  }: {
    initGraph: (graphSettings?: Parameters<GraphStore['initGraph']>[0]['graphSettings']) => GraphStore;
    addTooltip: () => ReturnType<typeof initTooltip>;
    addBrushSelect: () => BrushSelect;
    addShortcuts: typeof addCanvasShortcut;
    addCleanup: (fn: (...args: unknown[]) => unknown) => void;
  }) => void | Promise<void>;
  sx?: SxProps<Theme>;
}>) {
  const theme = useTheme();
  const { t } = useTranslation();
  useEffect(() => {
    explorerItem.setRuntime(theme, t);
  }, [explorerItem, theme, t]);
  const graphDomRef = useRef<HTMLDivElement | undefined>(undefined);
  const { showBackGrid } = explorerItem.graph;
  const runBoxSelect = useCallback(
    ({ left, bottom, top, right }: Record<string, number>) => {
      const { twoGraph, selectLinks, selectNodes, unsafeAction } = explorerItem.graph;
      if (!twoGraph) return;
      const tl = twoGraph.instance.screen2GraphCoords(left, top);
      const br = twoGraph.instance.screen2GraphCoords(right, bottom);
      const { nodes, links } = twoGraph.instance.graphData();
      const selectedNodes = nodes.filter((node) => {
        const { x = 0, y = 0 } = node;
        return tl.x < x && x < br.x && br.y > y && y > tl.y;
      });
      const selectedLinks = links.filter((link) => {
        const source = link.source as NodeObject;
        const target = link.target as NodeObject;
        const { x: sourceX = 0, y: sourceY = 0 } = source;
        const { x: targetX = 0, y: targetY = 0 } = target;
        const topLeft = {
          x: Math.min(sourceX, targetX),
          y: Math.min(sourceY, targetY),
        };
        const bottomRight = {
          x: Math.max(sourceX, targetX),
          y: Math.max(sourceY, targetY),
        };
        return tl.x < topLeft.x && tl.y < topLeft.y && br.x > bottomRight.x && br.y > bottomRight.y;
      });
      unsafeAction(() => {
        selectNodes(selectedNodes);
        selectLinks(selectedLinks);
      });
    },
    [explorerItem]
  );

  useEffect(() => {
    if (!explorerItem.explorerId) return;
    const { graph } = explorerItem;
    const graphDom = graphDomRef.current!;

    const cleanupFns: (() => void)[] = [];
    const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();
    const schedule = (fn: () => void, delay: number) => {
      const timeout = setTimeout(() => {
        pendingTimeouts.delete(timeout);
        fn();
      }, delay);
      pendingTimeouts.add(timeout);
    };
    onInitGraph({
      initGraph: (graphSettings) => {
        graph.initGraph({
          container: graphDom,
          graphSettings: graphSettings || {},
        });
        return graph;
      },
      addTooltip: () => initTooltip({ container: graphDom, explorerItem }),
      addBrushSelect: () => new BrushSelect({ container: graphDom, runBoxSelect }),
      addShortcuts: addCanvasShortcut,
      addCleanup: (fn) => cleanupFns.push(fn),
    });

    // Auto zoom to overview after graph initialization
    const autoZoomConfig = {
      enabled: true,
      initialDelay: 500,
      dataChangeDelay: 400,
      maxRetries: 20,
    };
    const autoZoomToOverview = () => {
      if (!autoZoomConfig.enabled || !graph.twoGraph || graph.nodes.size === 0) return;

      let retryCount = 0;
      const checkGraphReady = () => {
        if (retryCount >= autoZoomConfig.maxRetries) {
          return;
        }

        if (graph.twoGraph?.instance) {
          // Check if graph has data and is ready
          const graphData = graph.twoGraph.instance.graphData();
          if (graphData.nodes.length > 0) {
            // Graph is ready, auto-fit with a delay to ensure rendering is complete
            schedule(() => {
              graph.twoGraph?.autoFit();
            }, autoZoomConfig.initialDelay || 500);
          } else {
            // Graph not ready yet, try again
            retryCount++;
            schedule(checkGraphReady, 100);
          }
        } else {
          // Graph instance not ready yet, try again
          retryCount++;
          schedule(checkGraphReady, 50);
        }
      };

      // Start checking after a short delay to allow initial setup
      schedule(checkGraphReady, 300);
    };

    autoZoomToOverview();

    return () => {
      pendingTimeouts.forEach(clearTimeout);
      cleanupFns.forEach((fn) => fn());
      graph.destroyGraph();
    };
  }, [explorerItem]);

  return (
    <Box
      flex={1}
      height="100%"
      overflow="hidden"
      position={explorerItem.isFullScreen ? 'fixed' : 'relative'}
      className={explorerItem.isFullScreen ? fullScreenCls : undefined}
      sx={sx}
    >
      <Box
        component="div"
        tabIndex={0}
        onPointerDown={(event) => event.currentTarget.focus({ preventScroll: true })}
        className={`${veEditorBackCls} ${showBackGrid && veEditorBackGridCls[theme.palette.mode]}`}
        height="100%"
        sx={{
          '&, & canvas, & svg': { userSelect: 'none' },
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg5,
        }}
        ref={graphDomRef}
      />
      {children}
    </Box>
  );
});
