import { Box } from '@mui/material';
import { ArrowLeftTop, ArrowRightTop } from '@vesoft-inc/icons';
import { ActionButton } from '../../../graph/components/Minimap/index';
import { observer } from 'mobx-react-lite';
import type { GraphWorkspaceStore } from '../../../graph/stores/workspace';

function RedoUndo({ explorerItem }: { explorerItem: GraphWorkspaceStore }) {
  const { graph } = explorerItem;
  const { historyLength, historyIndex } = graph;
  return (
    <Box
      display="flex"
      sx={{
        position: 'absolute',
        top: 24,
        right: 20,
      }}
    >
      <ActionButton
        disabled={historyIndex < 1}
        onClick={() => {
          graph.undo();
        }}
      >
        <ArrowLeftTop sx={{ width: '16px', height: '16px' }} />
      </ActionButton>
      <ActionButton
        sx={{ ml: 1 }}
        disabled={historyIndex >= historyLength - 1}
        onClick={() => {
          graph.redo();
        }}
      >
        <ArrowRightTop sx={{ width: '16px', height: '16px' }} />
      </ActionButton>
    </Box>
  );
}

export default observer(RedoUndo);
