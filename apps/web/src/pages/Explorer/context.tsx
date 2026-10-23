import { createContext, useContext } from 'react';
import { ExplorerStore } from '@studio/stores/explorer';

const ExplorerStoreContext = createContext<ExplorerStore | null>(null);

export function useExplorerStore() {
  const store = useContext(ExplorerStoreContext);
  if (!store) {
    throw new Error('useExplorerStore must be used within Explorer');
  }
  return store;
}

export const ExplorerStoreProvider = ExplorerStoreContext.Provider;
