import { FC, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import Box from '@mui/material/Box';
import { useParams } from 'react-router-dom';
import { Drawer } from '@vesoft-inc/ui-components';
import { IconButton, type Theme } from '@mui/material';
import { FormatIndentDecrease, FormatIndentIncrease } from '@vesoft-inc/icons';
import { useStore } from '@studio/stores';
import PageLoading from '@studio/components/GraphWorkbench/PageLoading';
import GraphHeader from './Header';
import GraphSiderTools from './SiderTools';
import GraphContent from './Content';
import RightSideTool from '@studio/components/GraphWorkbench/RightSideTool';
import { GraphWorkspaceStore } from '@studio/stores/graph/workspace';
import { execGql } from '@studio/services';
import { useExplorerSettings } from '../Snapshots/hook';

const RIGHT_SIDE_DRAWER_WIDTH = 355;
/** Collapsed strip only fits the 24px toggle button plus a 2px gutter on each side. */
const RIGHT_SIDE_DRAWER_COLLAPSED_WIDTH = 28;

function withExplorerSettings<T>(WrappedComponent: FC<T>) {
  return observer((props: NonNullable<T>) => {
    const { explorerStore, commonStore } = useStore();

    const username = commonStore.userInfo?.username;

    const { remoteAppConfigQuery, remotePersonalConfigQuery } = useExplorerSettings({
      enabled: true,
      username,
    });

    const [isLoading, setIsLoading] = useState(true);
    const isPending = remoteAppConfigQuery.isPending || remotePersonalConfigQuery.isPending;
    useEffect(() => {
      if (!isPending) {
        explorerStore.updateSettings((prev) => ({
          ...prev,
          ...remoteAppConfigQuery.settings,
          ...remotePersonalConfigQuery.settings,
        }));
      }
      setIsLoading(isPending);
    }, [remoteAppConfigQuery.settings, remotePersonalConfigQuery.settings, isPending, explorerStore]);

    if (isLoading) {
      return (
        <Box display="flex" alignItems="center" justifyContent="center" width="100%" height="100%">
          <PageLoading />
        </Box>
      );
    }

    return <WrappedComponent {...props} />;
  });
}

function ExplorerGraph() {
  const { snapshotId } = useParams();
  const rootStore = useStore();
  const { explorerStore } = rootStore;
  const { loading } = explorerStore;
  const [graphWorkspace, setGraphWorkspace] = useState<GraphWorkspaceStore>();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!snapshotId) return;
    const workspace = new GraphWorkspaceStore({
      stores: rootStore,
      execGql,
      explorerId: snapshotId,
      settings: explorerStore.settings,
    });
    setGraphWorkspace(workspace);
    explorerStore.openSnapshot(snapshotId, workspace);

    return () => {
      explorerStore.updateGraphWorkspace(undefined);
      workspace.destroy();
    };
  }, [explorerStore, rootStore, snapshotId]);

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
          width="100vw"
          height="100vh"
          zIndex={(theme) => theme.zIndex.drawer + 10}
        >
          <PageLoading />
        </Box>
      )}
      <GraphHeader />
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
              <RightSideTool explorerItem={graphWorkspace} allowRemoteIconManagement />
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

const observedExplorerGraph = withExplorerSettings(observer(ExplorerGraph));

export default observedExplorerGraph;
