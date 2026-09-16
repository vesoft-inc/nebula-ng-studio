import { observer } from 'mobx-react-lite';
import { useStore } from '@studio/stores';
import Tooltip from '@studio/components/GraphWorkbench/GraphTooltip';
import Minimap, {
  MinimapActionButtonFullScreen,
  MinimapActionButtonGraphLayout,
  MinimapActionButtonZoomIn,
  MinimapActionButtonZoomOut,
} from '@studio/components/GraphWorkbench/Minimap';
import ContextMenu from '../ContextMenu';
import RedoUndo from '../RedoUndo';
import EmptyContent from './EmptyContent';
import SelectedEntityInfo from './SelectedEntityInfo';
import KeyboardTip from './KeyboardTip';
import { CommonGraphContent } from '@studio/components/GraphWorkbench/Content';

function GraphContent() {
  const rootStore = useStore();
  const { explorerStore } = rootStore;
  const { graphWorkspace } = explorerStore;
  const { hasEntitySelected } = graphWorkspace.graph;
  const explorerItem = graphWorkspace;

  return (
    <CommonGraphContent
      explorerItem={explorerItem}
      onInitGraph={({ initGraph, addTooltip, addBrushSelect, addShortcuts, addCleanup }) => {
        const graph = initGraph({
          disableHighlightNeighborsOnHover: !explorerStore.settings.highlightNeighborsOnHover,
        });
        const destroyTooltip = addTooltip();
        const brushSelect = addBrushSelect();
        const removeShortcuts = addShortcuts(explorerItem);
        addCleanup(() => {
          destroyTooltip();
          brushSelect.destroy();
          removeShortcuts();
          graph.destroyGraph();
          graph.twoGraph?.destroy();
        });
      }}
    >
      {graphWorkspace.graph.isEmpty && <EmptyContent explorerItem={explorerItem} />}
      <KeyboardTip />
      {explorerStore.settings.displayPropertiesOnHover && <Tooltip explorerItem={explorerItem} />}
      <Minimap explorerItem={explorerItem}>
        {({ Wrapper, minimapToggleButton }) => (
          <Wrapper>
            <MinimapActionButtonGraphLayout explorerItem={explorerItem} />
            <MinimapActionButtonZoomIn explorerItem={explorerItem} />
            <MinimapActionButtonZoomOut explorerItem={explorerItem} />
            {minimapToggleButton}
            <MinimapActionButtonFullScreen explorerItem={explorerItem} />
          </Wrapper>
        )}
      </Minimap>
      <ContextMenu explorerItem={explorerItem} />
      <RedoUndo explorerItem={explorerItem} />
      {hasEntitySelected && <SelectedEntityInfo explorerItem={explorerItem} />}
    </CommonGraphContent>
  );
}

const observedGraphContent = observer(GraphContent);

export default observedGraphContent;
