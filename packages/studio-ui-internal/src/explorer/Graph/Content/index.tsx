import { observer } from 'mobx-react-lite';
import { useExplorerStore } from '../../context';
import Tooltip from '../../../graph/components/GraphTooltip/index';
import Minimap, {
  MinimapActionButtonFullScreen,
  MinimapActionButtonGraphLayout,
  MinimapActionButtonZoomIn,
  MinimapActionButtonZoomOut,
} from '../../../graph/components/Minimap/index';
import ContextMenu from '../ContextMenu/index';
import RedoUndo from '../RedoUndo/index';
import EditActionBar from '../EditToolbar/index';
import GraphEditDialogs from '../EditPanel/GraphEditDialogs';
import EmptyContent from './EmptyContent';
import SelectedEntityInfo from './SelectedEntityInfo';
import KeyboardTip from './KeyboardTip';
import { CommonGraphContent } from '../../../graph/components/Content/index';

function GraphContent() {
  const explorerStore = useExplorerStore();
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
      {graphWorkspace.restoreState !== 'restoring' && graphWorkspace.graph.isEmpty && (
        <EmptyContent explorerItem={explorerItem} />
      )}
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
      <EditActionBar explorerItem={explorerItem} />
      <GraphEditDialogs explorerItem={explorerItem} />
      {hasEntitySelected && <SelectedEntityInfo explorerItem={explorerItem} />}
    </CommonGraphContent>
  );
}

const observedGraphContent = observer(GraphContent);

export default observedGraphContent;
