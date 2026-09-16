import { Box } from '@mui/material';
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';
import { useStore } from '@studio/stores';

function Explorer() {
  const { explorerStore } = useStore();

  useEffect(() => {
    explorerStore.getCurrentSchema();
    explorerStore.getGraphItems();
  }, [explorerStore]);

  return (
    <Box display="flex" flexDirection="column" height="100%" overflow="hidden" position="relative">
      <Box flex={1} minHeight={0} overflow="auto">
        <Outlet />
      </Box>
    </Box>
  );
}

export default observer(Explorer);
