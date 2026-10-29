import { toJS } from 'mobx';
import type {
  ConsoleServices,
  QueryExecutor,
  QueryOptions,
  SchemaServices,
  SchemaEditorServices,
  ExplorerServices,
  IconServices,
} from '../services';
import type { Lifetime } from './lifetime';

export function bindQuery(execute: QueryExecutor, life: Lifetime): QueryExecutor {
  return <T extends object>(gql: string, options?: QueryOptions) =>
    life.request((request) => execute<T>(gql, request), options);
}
export function bindConsole(services: ConsoleServices, life: Lifetime): ConsoleServices {
  return {
    execute: bindQuery(services.execute.bind(services), life),
    query: bindQuery(services.query.bind(services), life),
    cancelQuery: services.cancelQuery
      ? (id, options) => life.request((request) => services.cancelQuery!(id, request), options)
      : undefined,
    getSessionId: services.getSessionId
      ? (options) => life.request((request) => services.getSessionId!(request), options)
      : undefined,
  };
}
export function bindSchema(services: SchemaServices, life: Lifetime): SchemaServices {
  return {
    execute: bindQuery(services.execute.bind(services), life),
    switchSchema: services.switchSchema
      ? (path, options) => life.request((request) => services.switchSchema!(path, request), options)
      : undefined,
    importDataset: services.importDataset
      ? (dataset, options) => life.request((request) => services.importDataset!(dataset, request), options)
      : undefined,
    sweepLayouts: services.sweepLayouts
      ? (path, names, options) => life.request((request) => services.sweepLayouts!(path, names, request), options)
      : undefined,
  };
}
export function bindEditor(services: SchemaEditorServices, life: Lifetime): SchemaEditorServices {
  const { layouts, sketches } = services;
  return {
    execute: bindQuery(services.execute.bind(services), life),
    layouts: layouts
      ? {
          read: (name, options) => life.request((request) => layouts.read(name, request), options),
          write: (name, layout, options) => life.request((request) => layouts.write(name, layout, request), options),
          migrate: layouts.migrate
            ? (from, to, layout, options) =>
                life.request((request) => layouts.migrate!(from, to, layout, request), options)
            : undefined,
        }
      : undefined,
    sketches: sketches
      ? {
          list: (filter, options) => life.request((request) => sketches.list(filter, request), options),
          read: (id, options) => life.request((request) => sketches.read(id, request), options),
          create: (item, options) => life.request((request) => sketches.create(item, request), options),
          delete: (id, options) => life.request((request) => sketches.delete(id, request), options),
        }
      : undefined,
  };
}
export function bindExplorer(services: ExplorerServices, life: Lifetime): ExplorerServices {
  const { snapshots, settings } = services;
  return {
    execute: bindQuery(services.execute.bind(services), life),
    snapshotVersion: services.snapshotVersion,
    snapshots: {
      list: (filter, options) => life.request((request) => snapshots.list(filter, request), options),
      create: (input, options) => life.request((request) => snapshots.create(input, request), options),
      read: (id, options) => life.request((request) => snapshots.read(id, request), options),
      update: (snapshot, options) => life.request((request) => snapshots.update(snapshot, request), options),
      delete: (id, options) => life.request((request) => snapshots.delete(id, request), options),
    },
    settings: settings
      ? {
          load: (options) => life.request((request) => settings.load(request), options),
          save: (value, options) =>
            life.request(
              (request) =>
                settings.save(
                  {
                    appConfigForm: { ...toJS(value.appConfigForm) },
                    personalConfigForm: { ...toJS(value.personalConfigForm) },
                  },
                  request
                ),
              options
            ),
        }
      : undefined,
  };
}
export function bindIcons(services: IconServices, life: Lifetime): IconServices {
  return {
    getIconGroupList: (type, options) => life.request((request) => services.getIconGroupList(type, request), options),
    getIconGroupItemList: (id, options) =>
      life.request((request) => services.getIconGroupItemList(id, request), options),
    addIconGroup: (values, options) => life.request((request) => services.addIconGroup(values, request), options),
    updateIconGroup: (values, options) => life.request((request) => services.updateIconGroup(values, request), options),
    deleteIconGroup: (id, options) => life.request((request) => services.deleteIconGroup(id, request), options),
    addIconGroupItem: (values, options) =>
      life.request((request) => services.addIconGroupItem(values, request), options),
    deleteIconGroupItem: (values, options) =>
      life.request((request) => services.deleteIconGroupItem(values, request), options),
  };
}
