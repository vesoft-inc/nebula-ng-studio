import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ConsoleResult } from './types';
import ConsoleController from './ConsoleController';
import { ConsoleResultHostProvider, type ConsoleResultHost } from './QueryResultCard/resultHost';
import type { GraphDataTable } from '../graph/types/console';
import type { ConsoleSettingsForm } from '../shared/Settings/constants';
import { useUi } from '../provider';

export interface ConsoleAppearance {
  prompt?: string;
  showPrompt?: boolean;
}
export interface ConsoleProviderProps {
  controller: ConsoleController;
  settings: ConsoleSettingsForm;
  appearance?: ConsoleAppearance;
  onExplore?: (result: ConsoleResult<GraphDataTable>, graph?: string) => Promise<void>;
  children: ReactNode;
}
const Context = createContext<Omit<ConsoleProviderProps, 'children'> | null>(null);

export function ConsoleProvider({ children, ...props }: ConsoleProviderProps) {
  const { controller, appearance, onExplore, settings } = props;
  const { modalStore } = useUi();
  const host = useMemo<ConsoleResultHost>(
    () => ({
      modalStore,
      prompt: appearance?.prompt,
      settings,
      execGql: controller.services.query,
      onReuseGql: controller.updateEditorValue,
      getWorkspace: (id) => controller.graphWorkspaces.get(id),
      saveWorkspace: (id, workspace) => {
        controller.graphWorkspaces.set(id, workspace);
      },
      deleteWorkspace: (id) => {
        controller.graphWorkspaces.delete(id);
      },
      prepareGraphTypes: controller.updateGraphTypeMap,
      graphTypesFor: (names) =>
        controller.graphs.filter((graph) => names.includes(graph.graph)).map((graph) => graph.graph_type),
      getResultSnapshot: controller.getResultSnapshot,
      onExplore,
    }),
    [controller, modalStore, appearance?.prompt, settings, onExplore]
  );
  return (
    <Context.Provider value={props}>
      <ConsoleResultHostProvider value={host}>{children}</ConsoleResultHostProvider>
    </Context.Provider>
  );
}
export function useConsole() {
  const context = useContext(Context);
  if (!context) throw new Error('ConsoleProvider is required');
  return context;
}
