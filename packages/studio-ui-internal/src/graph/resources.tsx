import { createContext, useContext, useState } from 'react';
import { IconCatalog } from './IconCatalog';

const Context = createContext<IconCatalog | null>(null);
export const GraphResourcesProvider = Context.Provider;

export function useIconCatalog() {
  const catalog = useContext(Context);
  const [localCatalog] = useState(() => new IconCatalog());
  return catalog ?? localCatalog;
}
