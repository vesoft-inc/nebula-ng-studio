import { useEffect, useState } from 'react';
import { SchemaController } from '@vesoft-inc/studio-ui-internal/schema/model';
import type { StudioServices } from '../services';
import { useStudioScope } from '../provider';
import { requireService, useWorkbench } from './hooks';
import type { StudioScope } from './scope';
import { bindEditor, bindSchema } from './adapters';

export function acquireSchema(scope: StudioScope, services: StudioServices) {
  const service = requireService(services, 'schema');
  return scope.acquire('schema', { schema: service }, (lifetime) => {
    const adapted = bindSchema(service, lifetime);
    const controller = new SchemaController(adapted);
    if (scope.schemaPath !== undefined) controller.updateCurrentSchame({ path: scope.schemaPath });
    const switchSchema = async (path: string) => {
      if (!lifetime.active) return;
      const response = await controller.switchSchema(path);
      if (lifetime.active && response.code === 0 && controller.currentSchema.path === path) scope.setSchema(path);
      return response;
    };
    let initialization: Promise<void> | undefined;
    const initialize = () => {
      if (controller.currentSchema.path) return Promise.resolve();
      return (initialization ??= controller
        .refreshCurrentSchema()
        .then((response) => {
          if (response.code !== 0) throw new Error(response.message);
        })
        .finally(() => {
          initialization = undefined;
        }));
    };
    return {
      value: { controller, services: adapted, initialize, switchSchema },
      dispose: controller.destroy,
      schemaChanged: (path: string) => controller.updateCurrentSchame({ path }),
    };
  });
}
export function acquireEditor(scope: StudioScope, services: StudioServices) {
  const source = requireService(services, 'schemaEditor');
  return scope.acquire('schemaEditor', { schemaEditor: source }, (lifetime) => ({
    value: bindEditor(source, lifetime),
    dispose: () => {},
  }));
}

export function useSchemaComponent(name: string, withSketches = false) {
  const { services } = useStudioScope();
  requireService(services, 'schema');
  const binding = useWorkbench(
    name,
    { schema: services.schema, ...(withSketches ? { schemaEditor: services.schemaEditor } : {}) },
    (scope) => {
      const catalog = acquireSchema(scope, services);
      const editor = withSketches && services.schemaEditor ? acquireEditor(scope, services) : undefined;
      return {
        ...catalog,
        isCurrent: () => !editor || editor.lifetime.active,
        value: { ...catalog.value, sketches: editor?.value.sketches },
      };
    }
  );
  const { resource } = binding;
  const [ready, setReady] = useState<typeof resource>();
  useEffect(() => {
    let active = true;
    if (resource)
      void resource.value
        .initialize()
        .catch(() => {})
        .finally(() => {
          if (active) setReady(resource);
        });
    return () => {
      active = false;
    };
  }, [resource]);
  return { ...binding, ready: !!resource && ready === resource };
}
