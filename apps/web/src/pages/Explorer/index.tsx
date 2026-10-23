import { Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { EXPLORER_DEFAULT_SETTINGS } from '@studio/components/Settings/constants';
import { CommonStore } from '@studio/stores/common';
import { ExplorerStore } from '@studio/stores/explorer';
import { commonStore, consoleStore, schemaStore } from '@studio/stores/session';
import { ExplorerStoreProvider } from './context';

const initialSettings = {
  ...EXPLORER_DEFAULT_SETTINGS.appConfigForm,
  ...EXPLORER_DEFAULT_SETTINGS.personalConfigForm,
};

function Explorer() {
  const [store] = useState(() => new ExplorerStore({ settings: initialSettings, schemaStore, consoleStore }));

  useEffect(() => {
    store.getCurrentSchema();
    store.getGraphItems();
    const unregister =
      commonStore instanceof CommonStore ? commonStore.registerExplorerDestroy(() => store.destroy()) : undefined;
    return () => {
      unregister?.();
      store.destroy();
    };
  }, [store]);

  return (
    <ExplorerStoreProvider value={store}>
      <Box display="flex" flexDirection="column" height="100%" overflow="hidden" position="relative">
        <Box flex={1} minHeight={0} overflow="auto">
          <Outlet />
        </Box>
      </Box>
    </ExplorerStoreProvider>
  );
}

export default Explorer;
