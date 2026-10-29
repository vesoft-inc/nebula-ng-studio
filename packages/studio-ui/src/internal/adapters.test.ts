import { describe, expect, it, vi } from 'vitest';
import { isObservable } from 'mobx';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { ExplorerController } from '@vesoft-inc/studio-ui-internal/explorer/model';
import { bindConsole, bindEditor, bindExplorer, bindSchema } from './adapters';
import { Lifetime } from './lifetime';
import { acquireEditor } from './schema';
import { StudioScope } from './scope';
import type { ConsoleServices, ExplorerServices, QueryExecutor, QueryOptions, SnapshotServices } from '../services';

function snapshots(): SnapshotServices {
  return { list: vi.fn(), create: vi.fn(), read: vi.fn(), update: vi.fn(), delete: vi.fn() };
}

class QueryService implements ConsoleServices, ExplorerServices {
  readonly snapshots = snapshots();
  lastOptions?: QueryOptions;
  constructor(private label: string) {}
  async execute<T extends object>(_gql: string, options?: QueryOptions): Promise<ServerResponse<T>> {
    this.lastOptions = options;
    return { code: 0, message: `${this.label}:execute` };
  }
  async query<T extends object>(_gql: string, options?: QueryOptions): Promise<ServerResponse<T>> {
    this.lastOptions = options;
    return { code: 0, message: `${this.label}:query` };
  }
}

const queries: Array<[string, (service: QueryService, lifetime: Lifetime) => QueryExecutor, string]> = [
  ['Console execute', (service, lifetime) => bindConsole(service, lifetime).execute, 'execute'],
  ['Console query', (service, lifetime) => bindConsole(service, lifetime).query, 'query'],
  ['Schema', (service, lifetime) => bindSchema(service, lifetime).execute, 'execute'],
  ['SchemaEditor', (service, lifetime) => bindEditor(service, lifetime).execute, 'execute'],
  ['Explorer', (service, lifetime) => bindExplorer(service, lifetime).execute, 'execute'],
];

describe('Public service adapters', () => {
  it.each(queries)('preserves the receiver and request options for %s', async (_name, adapt, method) => {
    const lifetime = new Lifetime(() => true);
    const service = new QueryService('connection');
    try {
      await expect(adapt(service, lifetime)('RETURN 1', { queryTimeout: 2500 })).resolves.toMatchObject({
        message: `connection:${method}`,
      });
      expect(service.lastOptions?.queryTimeout).toBe(2500);
      expect(service.lastOptions?.signal?.aborted).toBe(false);
    } finally {
      lifetime.dispose();
    }
  });

  it('preserves the schema service receiver when it supplies the editor fallback', async () => {
    const service = new QueryService('schema');
    const services = { schema: service };
    const scope = new StudioScope(services, '/one');
    try {
      const editor = acquireEditor(scope, services, true);
      await expect(editor.value.execute('RETURN 1')).resolves.toMatchObject({ message: 'schema:execute' });
    } finally {
      scope.dispose();
    }
  });

  it('saves a cloneable settings record without sharing observable state', async () => {
    const lifetime = new Lifetime(() => true);
    const service = new QueryService('explorer');
    const save = vi.fn<NonNullable<ExplorerServices['settings']>['save']>().mockResolvedValue(undefined);
    const adapted = bindExplorer(
      { ...service, execute: service.execute.bind(service), settings: { load: async () => ({}), save } },
      lifetime
    );
    const controller = new ExplorerController({
      services: adapted,
      settings: {},
      schemaStore: {} as never,
    });
    try {
      await controller.saveSettings();
      const saved = save.mock.calls[0][0];
      expect(() => structuredClone(saved)).not.toThrow();
      expect(isObservable(saved)).toBe(false);
      expect(isObservable(saved.appConfigForm)).toBe(false);
      expect(isObservable(saved.personalConfigForm)).toBe(false);
      expect(save.mock.calls[0][1]?.signal?.aborted).toBe(false);

      const timeout = controller.settingsGroups.appConfigForm.queryTimeout;
      saved.appConfigForm.queryTimeout = timeout + 1;
      expect(controller.settingsGroups.appConfigForm.queryTimeout).toBe(timeout);
      controller.setSettingsGroup('personalConfigForm', {
        ...controller.settingsGroups.personalConfigForm,
        displayPropertiesOnHover: false,
      });
      expect(saved.personalConfigForm.displayPropertiesOnHover).toBe(true);
    } finally {
      controller.destroy();
      lifetime.dispose();
    }
  });
});
