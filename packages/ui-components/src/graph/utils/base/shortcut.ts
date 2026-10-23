import { EdgeDirectionType } from '@vesoft-inc/utils';
import { ALL_EDGE_TYPE_KEY } from '../../constants';
import type { GraphWorkspaceStore } from '../../stores/workspace';

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
  const container = graphStore.graphContainer;
  if (!container) return () => {};
  let zooming = false;

  const stopZoom = () => {
    if (!zooming) return;
    graphStore.twoGraph?.onZoomMouseUp();
    zooming = false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return;
    const target = e.target;
    if (
      target instanceof Element &&
      target.closest(
        'input, textarea, select, button, a[href], [role="button"], [role="textbox"], [contenteditable]:not([contenteditable="false"])'
      )
    ) {
      return;
    }
    const { twoGraph } = graphStore;
    switch (true) {
      case e.key === 'Enter' && shortcut.enter !== false:
        // edit mode uses Enter-free flows: two selected nodes define a new edge instead
        if (graphStore.explorerStore.graphEdit.editMode) break;
        if (graphStore.nodesSelected.size) {
          e.preventDefault();
          explorerItem.graph.queryRelation(ALL_EDGE_TYPE_KEY, EdgeDirectionType.AnyDirection, 1);
        }
        break;
      case e.key === '_':
        // shift + '-' zoom out
        e.preventDefault();
        twoGraph?.onZoomMouseUp();
        twoGraph?.zoom('out');
        zooming = true;
        break;
      case e.key === '+':
        // shift + '+' zoom in
        e.preventDefault();
        twoGraph?.onZoomMouseUp();
        twoGraph?.zoom('in');
        zooming = true;
        break;
      // case e.keyCode === 76 && e.shiftKey:
      //   // shift + l open show modal
      //   setPanelType(MENU_TYPE.propertyView);
      //   break;
      case e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey && shortcut.undo !== false:
        e.preventDefault();
        graphStore.undo();
        break;
      case e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey && shortcut.redo !== false:
        e.preventDefault();
        graphStore.redo();
        break;
      case e.key === 'Backspace' && shortcut.delete !== false:
        //  del delete
        e.preventDefault();
        if (graphStore.explorerStore.graphEdit.editMode) {
          graphStore.explorerStore.graphEdit.openDeleteConfirm();
        } else {
          graphStore.deleteNodesAndEdges({ reverse: e.shiftKey });
        }
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
      default:
        break;
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (['_', '-', '+', '='].includes(e.key)) stopZoom();
  };

  const handleFocusOut = (e: FocusEvent) => {
    if (!(e.relatedTarget instanceof Node) || !container.contains(e.relatedTarget)) stopZoom();
  };

  container.addEventListener('keydown', handleKeyDown);
  container.addEventListener('keyup', handleKeyUp);
  container.addEventListener('focusout', handleFocusOut);
  window.addEventListener('blur', stopZoom);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    container.removeEventListener('keyup', handleKeyUp);
    container.removeEventListener('focusout', handleFocusOut);
    window.removeEventListener('blur', stopZoom);
    stopZoom();
  };
};
