import { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { ExplorerController, ExplorerWorkbench } from '@vesoft-inc/ui-components/explorer';
import { EXPLORER_DEFAULT_SETTINGS } from '@vesoft-inc/ui-components/settings';
import { commonStore, consoleStore, schemaStore } from '@studio/stores/session';
import { createExplorerServices } from '@studio/services/explorerWorkbench';

export default observer(function Explorer() {
  const username = commonStore.userInfo?.username;
  const address = commonStore.userInfo?.address;
  const services = useMemo(
    () => ({
      ...createExplorerServices(username),
      onSnapshotDeleted: consoleStore.removeResultSnapshotsBySnapshotId,
      onSchemaChanged: (path: string) => {
        if (commonStore.userInfo) commonStore.setUserInfo({ ...commonStore.userInfo, curSchemaPath: path });
      },
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
  const { snapshotId } = useParams();
  const navigate = useNavigate();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !!controller.graphWorkspace?.graph.shouldBlockRouter && currentLocation.pathname !== nextLocation.pathname
  );
  return (
    <ExplorerWorkbench
      services={services}
      controller={controller}
      snapshotId={snapshotId ?? null}
      onSnapshotChange={(id) => navigate(id ? `/explorer/snapshots/${encodeURIComponent(id)}` : '/explorer/snapshots')}
      blocker={blocker}
      allowRemoteIconManagement
    />
  );
});
