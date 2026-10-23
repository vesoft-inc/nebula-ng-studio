import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { ExplorerStore } from './ExplorerController';
import { ExplorerStoreProvider } from './context';
import type { ExplorerNavigationBlocker, ExplorerServices } from './services';
import type { SchemaServices } from '../schema/services';
import SchemaController from '../schema/SchemaController';
import ExplorerGraph from './Graph';
import SnapshotList from './Snapshots';
import PageLoading from '../shared/PageLoading';
import { EXPLORER_DEFAULT_SETTINGS, type Settings4GraphStore } from '../shared/Settings/constants';

export interface ExplorerWorkbenchProps {
  services: ExplorerServices;
  controller?: ExplorerStore;
  schemaController?: SchemaController;
  schemaServices?: SchemaServices;
  initialSettings?: Settings4GraphStore;
  /** null selects the snapshot list; omit to use internal navigation. */
  snapshotId?: string | null;
  onSnapshotChange?: (id: string | null) => void;
  blocker?: ExplorerNavigationBlocker;
  allowRemoteIconManagement?: boolean;
}

export function ExplorerLayout({ children }: { children: ReactNode }) {
  return (
    <Box display="flex" flexDirection="column" height="100%" overflow="hidden" position="relative">
      <Box flex={1} minHeight={0} overflow="auto">
        {children}
      </Box>
    </Box>
  );
}

const ExplorerContent = observer(function ExplorerContent({
  controller,
  snapshotId: controlledId,
  onSnapshotChange,
  blocker,
  allowRemoteIconManagement,
}: Pick<ExplorerWorkbenchProps, 'snapshotId' | 'onSnapshotChange' | 'blocker' | 'allowRemoteIconManagement'> & {
  controller: ExplorerStore;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string | null } | null>(null);
  const open = (id: string | null) => {
    setSelected(id);
    onSnapshotChange?.(id);
  };
  const navigate = (id: string | null) => {
    if (!blocker && controller.graphWorkspace?.graph.shouldBlockRouter) setPending({ id });
    else open(id);
  };
  const localBlocker = useMemo<ExplorerNavigationBlocker>(
    () => ({
      state: pending ? 'blocked' : 'unblocked',
      proceed: () => {
        if (pending) open(pending.id);
        setPending(null);
      },
      reset: () => setPending(null),
    }),
    [pending, onSnapshotChange]
  );
  const snapshotId = controlledId === undefined ? selected : controlledId;
  return (
    <ExplorerStoreProvider value={controller}>
      <ExplorerLayout>
        {snapshotId ? (
          <ExplorerGraph
            key={snapshotId}
            snapshotId={snapshotId}
            onBack={() => navigate(null)}
            blocker={blocker ?? localBlocker}
            allowRemoteIconManagement={allowRemoteIconManagement}
          />
        ) : (
          <SnapshotList onOpen={navigate} />
        )}
      </ExplorerLayout>
    </ExplorerStoreProvider>
  );
});

export function ExplorerWorkbench({
  services,
  controller,
  schemaController,
  schemaServices,
  initialSettings,
  ...props
}: ExplorerWorkbenchProps) {
  const catalog = useMemo(
    () =>
      controller?.schemaStore ??
      schemaController ??
      new SchemaController(schemaServices ?? { execute: services.execute }),
    [controller, schemaController, schemaServices, services]
  );
  const owned = useMemo(
    () =>
      controller ??
      new ExplorerStore({
        services,
        schemaStore: catalog,
        settings: {
          ...EXPLORER_DEFAULT_SETTINGS.appConfigForm,
          ...EXPLORER_DEFAULT_SETTINGS.personalConfigForm,
          ...initialSettings,
        },
      }),
    [controller, services, catalog]
  );
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    if (!controller && !schemaController) catalog.reset();
    void (async () => {
      await owned.getCurrentSchema();
      if (!active) return;
      await Promise.all([owned.getGraphItems(), owned.loadSettings()]);
    })()
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      if (!controller) owned.destroy();
      if (!controller && !schemaController) catalog.destroy();
    };
  }, [owned, catalog, controller, schemaController]);
  if (!ready) return <PageLoading />;
  return <ExplorerContent controller={owned} {...props} />;
}
