import { createContext, useContext, type ReactNode } from 'react';
import type { ModalStore } from '@vesoft-inc/ui-components/modal';
import type { ConsoleResult } from '@vesoft-inc/utils';
import type { GraphDataTable } from '@studio/interfaces/console';
import type { GraphWorkspaceStore } from '@studio/stores/graph/workspace';
import type { execGql } from '@studio/services';

export type ResultSnapshotRef = {
  snapshotId: string;
  graph: string;
};

export type RunGql = typeof execGql;

/** Data and actions a console result view needs. The page owns the stores. */
export type ConsoleResultHost = {
  /** Session storage key for graph display limits. The page chooses the prefix. */
  graphSettingsId: string;
  modalStore: ModalStore;
  execGql: RunGql;
  onReuseGql: (gql: string) => void;
  getWorkspace: (resultId: string) => GraphWorkspaceStore | undefined;
  saveWorkspace: (resultId: string, workspace: GraphWorkspaceStore) => void;
  deleteWorkspace: (resultId: string) => void;
  prepareGraphTypes: (graphNames: string[]) => Promise<void>;
  graphTypesFor: (graphNames: string[]) => string[];
  getResultSnapshot: (resultId: string) => ResultSnapshotRef | undefined;
  /** Absent when this host has no Explorer to open. */
  onExplore?: (result: ConsoleResult<GraphDataTable>, graph?: string) => Promise<void>;
};

const ConsoleResultHostContext = createContext<ConsoleResultHost | null>(null);

export function ConsoleResultHostProvider({ value, children }: { value: ConsoleResultHost; children: ReactNode }) {
  return <ConsoleResultHostContext.Provider value={value}>{children}</ConsoleResultHostContext.Provider>;
}

export function useConsoleResultHost() {
  const value = useContext(ConsoleResultHostContext);
  if (!value) {
    throw new Error('ConsoleResultHostProvider is required');
  }
  return value;
}
