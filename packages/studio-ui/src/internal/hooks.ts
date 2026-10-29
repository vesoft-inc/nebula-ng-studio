import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useStudioScope } from '../provider';
import type { Resource, StudioScope } from './scope';
import type { StudioServices } from '../services';

function isActive(resource: Resource<unknown>) {
  return resource.lifetime.active && (resource.isCurrent?.() ?? true);
}

export function useWorkbench<T>(
  name: string,
  dependencies: Partial<StudioServices>,
  acquire: (scope: StudioScope) => Resource<T>
) {
  const { scope } = useStudioScope();
  const revision = useSyncExternalStore(scope.subscribe, scope.getRevision);
  const token = useRef(Symbol(name));
  const [entry, setEntry] = useState<{
    scope: StudioScope;
    dependencies: Partial<StudioServices>;
    resource: Resource<T>;
  }>();
  const latest = useRef(acquire);
  latest.current = acquire;
  const mounted = useRef(false);
  const activeEntry = useRef(entry);
  useLayoutEffect(() => {
    const release = scope.mount(name, token.current);
    mounted.current = true;
    return () => {
      mounted.current = false;
      release();
    };
  }, [scope, name]);
  const { console: consoleService, schema, schemaEditor, explorer, icons } = dependencies;
  useLayoutEffect(() => {
    const current = activeEntry.current;
    if (
      current?.scope === scope &&
      isActive(current.resource) &&
      Object.entries(dependencies).every(([key, value]) => current.dependencies[key as keyof StudioServices] === value)
    )
      return;
    const next = { scope, dependencies, resource: latest.current(scope) };
    activeEntry.current = next;
    setEntry(next);
  }, [scope, revision, consoleService, schema, schemaEditor, explorer, icons]);
  const resource =
    entry?.scope === scope &&
    Object.entries(dependencies).every(([key, value]) => entry.dependencies[key as keyof StudioServices] === value) &&
    isActive(entry.resource)
      ? entry.resource
      : undefined;
  const guard =
    <A extends unknown[]>(callback: ((...args: A) => void) | undefined) =>
    (...args: A) => {
      if (mounted.current && activeEntry.current === entry && resource && isActive(resource)) callback?.(...args);
    };
  return { resource, scope, guard, isMounted: () => mounted.current && activeEntry.current === entry };
}

export function requireService<K extends keyof StudioServices>(
  services: StudioServices,
  domain: K
): NonNullable<StudioServices[K]> {
  const service = services[domain];
  if (!service) throw new Error(`StudioProvider services.${domain} is required for this workbench.`);
  return service as NonNullable<StudioServices[K]>;
}
