import { SchemaController } from '@vesoft-inc/studio-ui-internal/schema/model';
import type { StudioServices } from '../services';
import { requireService } from './hooks';
import type { StudioScope } from './scope';
import { bindEditor, bindSchema } from './adapters';

export function acquireSchema(scope: StudioScope, services: StudioServices) {
  const service = requireService(services, 'schema');
  return scope.acquire('schema', { schema: service }, (lifetime) => {
    const adapted = bindSchema(service, lifetime);
    const controller = new SchemaController(adapted);
    if (scope.schemaPath !== undefined) controller.updateCurrentSchame({ path: scope.schemaPath });
    return {
      value: { controller, services: adapted },
      dispose: controller.destroy,
      schemaChanged: (path: string) => controller.updateCurrentSchame({ path }),
    };
  });
}
export function acquireEditor(scope: StudioScope, services: StudioServices, allowSchemaFallback = false) {
  const own = services.schemaEditor;
  const fallback = allowSchemaFallback && services.schema;
  const source =
    own ?? (fallback ? { execute: fallback.execute.bind(fallback) } : requireService(services, 'schemaEditor'));
  return scope.acquire(
    'schemaEditor',
    own ? { schemaEditor: own } : { schemaEditor: undefined, schema: services.schema },
    (lifetime) => ({
      value: bindEditor(source, lifetime),
      dispose: () => {},
    })
  );
}
