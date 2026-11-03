import { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Outlet } from '@tanstack/react-router';
import { ExplorerController, ExplorerSession } from '@vesoft-inc/studio-ui-internal/explorer';
import { EXPLORER_DEFAULT_SETTINGS } from '@vesoft-inc/studio-ui-internal/settings';
import { commonStore, consoleStore, schemaStore } from '@studio/app/session';
import { createExplorerServices } from '@studio/services/explorerWorkbench';

export default observer(function ExplorerLayout() {
  const username = commonStore.userInfo?.username;
  const address = commonStore.userInfo?.address;
  const services = useMemo(
    () => ({
      ...createExplorerServices(username),
      onSnapshotDeleted: consoleStore.removeResultSnapshotsBySnapshotId,
      onSchemaChanged: commonStore.setSchemaPath,
    }),
    [username, address]
  );
  const controller = useMemo(
    () =>
      new ExplorerController({
        services,
        schemaStore,
        settings: {
          ...EXPLORER_DEFAULT_SETTINGS.appConfigForm,
          ...EXPLORER_DEFAULT_SETTINGS.personalConfigForm,
        },
      }),
    [services]
  );
  useEffect(() => {
    const unregister = commonStore.registerExplorerDestroy(() => controller.destroy());
    return () => {
      unregister?.();
      controller.destroy();
    };
  }, [controller]);
  return (
    <ExplorerSession services={services} controller={controller}>
      <Outlet />
    </ExplorerSession>
  );
});
