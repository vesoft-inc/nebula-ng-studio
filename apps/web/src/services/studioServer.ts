import {
  createStudioServerSchemaServices,
  createStudioServerSchemaEditorServices,
} from '@vesoft-inc/studio-ui/adapters/studio-server';
import type { SchemaServices } from '@vesoft-inc/studio-ui-internal/schema/model';
import type { SchemaEditorServices } from '@vesoft-inc/studio-ui-internal/schema-editor/model';
import type { QueryExecutor } from '@vesoft-inc/studio-ui-internal/console/model';
import { fetcher, backgroundFetcher } from './fetcher';
import { execGql } from './nebula';
import { inSession, sessionRequests } from './sessionRequests';

export interface LayoutIdentity {
  address?: string;
  username?: string;
  schemaPath?: string;
}

/** Owned by the application session, so route remounts retain each layout write queue. */
export class StudioServerAdapters {
  private signal?: AbortSignal;
  private schemas = new Map<string, SchemaServices>();
  private editors = new Map<string, SchemaEditorServices>();

  reset = () => {
    this.schemas.clear();
    this.editors.clear();
    this.signal = undefined;
  };

  private currentSignal() {
    const signal = sessionRequests.signal;
    if (this.signal !== signal) {
      this.reset();
      this.signal = signal;
    }
    return signal;
  }

  private query(signal: AbortSignal): QueryExecutor {
    return (gql, options) => inSession(signal, options, (request) => execGql(gql, request));
  }

  schema(identity: LayoutIdentity = {}): SchemaServices {
    const signal = this.currentSignal();
    const { address, username } = identity;
    const key = JSON.stringify([address, username]);
    const cached = this.schemas.get(key);
    if (cached) return cached;
    const base = createStudioServerSchemaServices({
      http: fetcher,
      backgroundHttp: backgroundFetcher,
      importDataset: true,
      layouts: address && username ? { address, username } : undefined,
    });
    const service: SchemaServices = {
      ...base,
      execute: this.query(signal),
      switchSchema: (path) => inSession(signal, undefined, (request) => base.switchSchema!(path, request)),
      importDataset: (dataset) => inSession(signal, undefined, (request) => base.importDataset!(dataset, request)),
      sweepLayouts: base.sweepLayouts
        ? (path, names) => inSession(signal, undefined, (request) => base.sweepLayouts!(path, names, request))
        : undefined,
    };
    this.schemas.set(key, service);
    return service;
  }

  editor(identity: LayoutIdentity): SchemaEditorServices {
    const signal = this.currentSignal();
    const { address, username, schemaPath = '' } = identity;
    const key = JSON.stringify([address, username, schemaPath]);
    const cached = this.editors.get(key);
    if (cached) return cached;
    const base = createStudioServerSchemaEditorServices({
      http: fetcher,
      backgroundHttp: backgroundFetcher,
      sketches: true,
      layouts: address && username ? { address, username, schemaPath } : undefined,
    });
    const service: SchemaEditorServices = {
      execute: this.query(signal),
      layouts: base.layouts
        ? {
            read: (name) => inSession(signal, undefined, (request) => base.layouts!.read(name, request)),
            write: (name, value) =>
              inSession(signal, undefined, (request) => base.layouts!.write(name, value, request)),
            migrate: (from, to, value) =>
              inSession(signal, undefined, (request) => base.layouts!.migrate!(from, to, value, request)),
          }
        : undefined,
      sketches: {
        list: (filter) => inSession(signal, undefined, (request) => base.sketches!.list(filter, request)),
        read: (id) => inSession(signal, undefined, (request) => base.sketches!.read(id, request)),
        create: (item) => inSession(signal, undefined, (request) => base.sketches!.create(item, request)),
        delete: (id) => inSession(signal, undefined, (request) => base.sketches!.delete(id, request)),
      },
    };
    this.editors.set(key, service);
    return service;
  }
}
