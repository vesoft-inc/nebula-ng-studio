import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ExplorerStore } from './ExplorerController';
import { ExplorerStoreProvider } from './context';
import type { ExplorerServices } from './services';
import SchemaController from '../schema/SchemaController';
import PageLoading from '../shared/PageLoading';
import { EXPLORER_DEFAULT_SETTINGS, type Settings4GraphStore } from '../shared/Settings/constants';

export type ExplorerSessionProps = { children: ReactNode } & (
  | { controller: ExplorerStore; services?: never; schemaController?: never; initialSettings?: never }
  | {
      services: ExplorerServices;
      controller?: never;
      schemaController?: SchemaController;
      initialSettings?: Settings4GraphStore;
    }
);

export function ExplorerSession({ children, ...options }: ExplorerSessionProps) {
  // Initial settings seed a new session. Changing them alone does not replace the workspace.
  const source = useMemo(() => options, [options.controller, options.services, options.schemaController]);
  const [ready, setReady] = useState<{ source: typeof source; explorer: ExplorerStore }>();
  useEffect(() => {
    const { controller, services, schemaController, initialSettings } = source;
    const explorer =
      controller ??
      new ExplorerStore({
        services,
        schemaStore: schemaController ?? new SchemaController({ execute: services.execute }),
        settings: {
          ...EXPLORER_DEFAULT_SETTINGS.appConfigForm,
          ...EXPLORER_DEFAULT_SETTINGS.personalConfigForm,
          ...initialSettings,
        },
      });
    let active = true;
    void (async () => {
      await explorer.getCurrentSchema();
      if (!active) return;
      await Promise.all([explorer.getGraphItems(), explorer.loadSettings()]);
    })()
      .catch(() => {})
      .finally(() => {
        if (active) setReady({ source, explorer });
      });
    return () => {
      active = false;
      if (!controller) explorer.destroy();
      if (!controller && !schemaController) explorer.schemaStore.destroy();
    };
  }, [source]);
  if (ready?.source !== source) return <PageLoading />;
  return <ExplorerStoreProvider value={ready.explorer}>{children}</ExplorerStoreProvider>;
}
