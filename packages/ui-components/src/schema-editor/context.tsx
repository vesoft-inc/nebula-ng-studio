import { createContext, useContext } from 'react';
import GraphTypeStore from './SchemaEditorController';

const GraphTypeStoreContext = createContext<GraphTypeStore | null>(null);

export function useGraphTypeStore() {
  const store = useContext(GraphTypeStoreContext);
  if (!store) {
    throw new Error('useGraphTypeStore must be used within Schema Manager');
  }
  return store;
}

export const GraphTypeStoreProvider = GraphTypeStoreContext.Provider;
