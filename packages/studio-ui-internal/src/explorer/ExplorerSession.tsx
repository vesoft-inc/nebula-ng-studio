import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ExplorerStore } from './ExplorerController';
import { ExplorerStoreProvider } from './context';
import type { ExplorerServices } from './services';
import type { SchemaServices } from '../schema/services';
import SchemaController from '../schema/SchemaController';
import PageLoading from '../shared/PageLoading';
import { EXPLORER_DEFAULT_SETTINGS, type Settings4GraphStore } from '../shared/Settings/constants';

/** Owns Explorer resources; the host chooses and mounts the page. */
export interface ExplorerSessionProps {
  services: ExplorerServices;
  controller?: ExplorerStore;
  schemaController?: SchemaController;
  schemaServices?: SchemaServices;
  initialSettings?: Settings4GraphStore;
  children: ReactNode;
}

export function ExplorerSession({
  services,
  controller,
  schemaController,
  schemaServices,
  initialSettings,
  children,
}: ExplorerSessionProps) {
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
  return <ExplorerStoreProvider value={owned}>{children}</ExplorerStoreProvider>;
}
