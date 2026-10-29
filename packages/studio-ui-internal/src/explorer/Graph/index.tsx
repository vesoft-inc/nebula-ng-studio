import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import Box from '@mui/material/Box';
import { Drawer } from '../../shared/index';
import { IconButton, type Theme } from '@mui/material';
import { FormatIndentDecrease, FormatIndentIncrease } from '@vesoft-inc/icons';
import { useExplorerStore } from '../context';
import PageLoading from '../../graph/components/PageLoading/index';
import GraphHeader from './Header/index';
import GraphSiderTools from './SiderTools/index';
import GraphContent from './Content/index';
import RightSideTool from '../../graph/components/RightSideTool/index';
import { GraphWorkspaceStore } from '../../graph/stores/workspace';
import { useModal } from '../../shared/useModal';
import type { ExplorerNavigationBlocker } from '../services';

const RIGHT_SIDE_DRAWER_WIDTH = 355;
/** Collapsed strip only fits the 24px toggle button plus a 2px gutter on each side. */
const RIGHT_SIDE_DRAWER_COLLAPSED_WIDTH = 28;

export interface ExplorerGraphProps {
  snapshotId: string;
  onBack?: () => void;
  blocker?: ExplorerNavigationBlocker;
  allowRemoteIconManagement?: boolean;
}
function ExplorerGraph({ snapshotId, onBack, blocker, allowRemoteIconManagement = false }: ExplorerGraphProps) {
  const modalStore = useModal();
  const explorerStore = useExplorerStore();
  const { loading } = explorerStore;
  const [graphWorkspace, setGraphWorkspace] = useState<GraphWorkspaceStore>();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!snapshotId) return;
    const workspace = new GraphWorkspaceStore({
      stores: { modalStore },
      execGql: explorerStore.services.execute,
      explorerId: snapshotId,
      settings: explorerStore.settings,
    });
    setGraphWorkspace(workspace);
    void explorerStore.openSnapshot(snapshotId, workspace).catch((error: unknown) => {
      if (explorerStore.graphWorkspace === workspace) {
        console.error('[explorer] Failed to open snapshot', snapshotId, error);
        modalStore.message.error(workspace.translate('openSnapshotFailed', { ns: 'explorer' }));
      }
    });

    return () => {
      explorerStore.updateGraphWorkspace(undefined);
      workspace.destroy();
    };
  }, [explorerStore, snapshotId, modalStore]);

  if (!graphWorkspace || explorerStore.graphWorkspace !== graphWorkspace) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" width="100%" height="100%">
        <PageLoading />
      </Box>
    );
  }

  const shouldShowLoading =
    loading || graphWorkspace.loading || graphWorkspace.graph.loading || graphWorkspace.restoreState === 'restoring';

  return (
    <Box display="flex" flexDirection="column" height="100%">
      {shouldShowLoading && (
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
          <PageLoading />
        </Box>
      )}
      <GraphHeader onBack={onBack} blocker={blocker} />
      <Box flex={1} display="flex" overflow="hidden">
        <GraphSiderTools />
        <GraphContent />
        <Drawer
          open={drawerOpen}
          variant="permanent"
          openWidth={RIGHT_SIDE_DRAWER_WIDTH}
          closeWidth={RIGHT_SIDE_DRAWER_COLLAPSED_WIDTH}
          sx={{
            height: '100%',
            '& .MuiDrawer-paper': {
              transition: 'width 0.3s',
              height: '100%',
              padding: 0,
              borderLeft: (theme: Theme) => `${theme.palette.vesoft.textColor6} 1px solid`,
              overflowX: 'hidden',
            },
          }}
        >
          <Box position="relative" height="100%" padding={drawerOpen ? '8px 16px' : 0}>
            <Box
              sx={{
                display: drawerOpen ? 'block' : 'none',
              }}
            >
              <RightSideTool explorerItem={graphWorkspace} allowRemoteIconManagement={allowRemoteIconManagement} />
            </Box>
            <IconButton
              sx={{
                position: 'absolute',
                bottom: 2,
                left: 2,
                fontWeight: 'bold',
              }}
              onClick={() => {
                setDrawerOpen(!drawerOpen);
              }}
            >
              {drawerOpen ? <FormatIndentIncrease /> : <FormatIndentDecrease />}
            </IconButton>
          </Box>
        </Drawer>
      </Box>
    </Box>
  );
}

const observedExplorerGraph = observer(ExplorerGraph);

export default observedExplorerGraph;
