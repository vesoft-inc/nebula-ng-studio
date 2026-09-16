import { EdgeDirectionType } from '@vesoft-inc/utils';
import { ALL_EDGE_TYPE_KEY } from '@studio/utils/explorer/constant';
import type { GraphWorkspaceStore } from '@studio/stores/graph/workspace';

export const addCanvasShortcut = (
  explorerItem: GraphWorkspaceStore,
  shortcut: {
    undo?: boolean;
    redo?: boolean;
    delete?: boolean;
    enter?: boolean;
  } = {}
) => {
  const { graph: graphStore } = explorerItem;

  const handleKeyDown = (e: KeyboardEvent) => {
    // ignore keydown event when focus on input or textarea
    if (['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement).tagName)) {
      return;
    }
    const { twoGraph } = graphStore;
    switch (true) {
      case e.key === 'Enter' && shortcut.enter !== false:
        if (graphStore.nodesSelected.size) {
          explorerItem.graph.queryRelation(ALL_EDGE_TYPE_KEY, EdgeDirectionType.AnyDirection, 1);
        }
        break;
      case e.key === '_':
        // shift + '-' zoom out
        twoGraph?.onZoomMouseUp();
        twoGraph?.zoom('out');
        break;
      case e.key === '+':
        // shift + '+' zoom in
        twoGraph?.onZoomMouseUp();
        twoGraph?.zoom('in');
        break;
      // case e.keyCode === 76 && e.shiftKey:
      //   // shift + l open show modal
      //   setPanelType(MENU_TYPE.propertyView);
      //   break;
      case e.keyCode === 90 && (e.metaKey || e.ctrlKey) && !e.shiftKey && shortcut.undo !== false:
        // shift + z undo
        graphStore.undo();
        break;
      case e.keyCode === 90 && (e.metaKey || e.ctrlKey) && e.shiftKey && shortcut.redo !== false:
        // ctrl+ shift + z redo
        graphStore.redo();
        break;
      case e.key === 'Backspace' && shortcut.delete !== false:
        //  del delete
        graphStore.deleteNodesAndEdges({ reverse: e.shiftKey });
        break;
      case e.key === 'a' && (e.metaKey || e.ctrlKey): {
        // cmd + a select all
        e.preventDefault();
        const nodes = Array.from(graphStore.nodes).filter(
          (node) => !graphStore.vertexFilterStore.entityIdsGreyScaledSet.has(node.id!)
        );
        graphStore.replaceNodeSelected(nodes);
        break;
      }
      case e.key === 'Tab':
        // tab
        e.preventDefault();
        break;
      default:
        break;
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    const { twoGraph } = graphStore;
    switch (true) {
      case e.keyCode === 189 && e.shiftKey:
      case e.keyCode === 187 && e.shiftKey:
        twoGraph?.onZoomMouseUp();
        break;
      default:
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
};
