import { useLayoutEffect, useState, type ReactNode } from 'react';
import { GraphResourcesProvider, IconCatalog } from '@vesoft-inc/studio-ui-internal/graph/resources';
import { useStudioScope } from '../provider';
import { bindIcons } from './adapters';

export function Resources({ children }: { children: ReactNode }) {
  const { scope, services } = useStudioScope();
  const [catalog, setCatalog] = useState<IconCatalog>();
  useLayoutEffect(() => {
    const resource = scope.acquire('icons', { icons: services.icons }, (lifetime) => {
      const value = new IconCatalog(services.icons ? bindIcons(services.icons, lifetime) : undefined);
      return { value, dispose: value.clear };
    });
    setCatalog(resource.value);
  }, [scope, services.icons]);
  return catalog ? <GraphResourcesProvider value={catalog}>{children}</GraphResourcesProvider> : null;
}
