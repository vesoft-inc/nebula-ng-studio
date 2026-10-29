import type { StudioServices } from '../services';
import { Lifetime } from './lifetime';

type Domain = keyof StudioServices;
export interface Resource<T> {
  value: T;
  lifetime: Lifetime;
  /** A composed workbench can depend on more than one domain lifetime. */
  isCurrent?: () => boolean;
  dispose: () => void;
  schemaChanged?: (path: string) => void;
  snapshotDeleted?: (id: string) => void;
}
interface Entry {
  resource: Resource<unknown>;
  dependencies: Partial<StudioServices>;
}

/** Private ownership registry. Factories are supplied by domain entries, never loaded by the provider. */
export class StudioScope {
  private entries = new Map<Domain, Entry>();
  private mounted = new Map<string, symbol>();
  private listeners = new Set<() => void>();
  private revision = 0;
  private activation = 0;
  active = true;
  schemaPath?: string;
  services: StudioServices;
  onSchemaChange?: (path: string) => void;

  constructor(services: StudioServices, schemaPath?: string) {
    this.services = services;
    this.schemaPath = schemaPath;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getRevision = () => this.revision;
  private changed() {
    this.revision++;
    this.listeners.forEach((listener) => listener());
  }

  activate() {
    this.activation++;
    this.active = true;
  }
  deactivate() {
    this.active = false;
    const activation = ++this.activation;
    // StrictMode's setup/cleanup/setup must retain the same session.
    queueMicrotask(() => {
      if (activation === this.activation && !this.active) this.dispose();
    });
  }
  dispose() {
    this.active = false;
    for (const { resource } of this.entries.values()) {
      resource.lifetime.dispose();
      resource.dispose();
    }
    this.entries.clear();
    this.mounted.clear();
  }
  configure(services: StudioServices, schemaPath: string | undefined) {
    this.services = services;
    let changed = false;
    for (const [key, entry] of this.entries) {
      if (Object.entries(entry.dependencies).some(([domain, value]) => services[domain as Domain] !== value)) {
        entry.resource.lifetime.dispose();
        entry.resource.dispose();
        this.entries.delete(key);
        changed = true;
      }
    }
    if (schemaPath !== undefined && schemaPath !== this.schemaPath) this.setSchema(schemaPath, false);
    if (changed) this.changed();
  }
  setSchema(path: string, notify = true) {
    if (!this.active || path === this.schemaPath) return;
    this.schemaPath = path;
    for (const [key, { resource }] of this.entries) {
      if (key === 'console' || key === 'schemaEditor' || key === 'explorer') {
        resource.lifetime.dispose();
        resource.dispose();
        this.entries.delete(key);
      } else resource.schemaChanged?.(path);
    }
    this.changed();
    if (notify) this.onSchemaChange?.(path);
  }
  snapshotDeleted(id: string) {
    if (this.active) for (const { resource } of this.entries.values()) resource.snapshotDeleted?.(id);
  }
  acquire<T>(
    domain: Domain,
    dependencies: Partial<StudioServices>,
    create: (lifetime: Lifetime) => Omit<Resource<T>, 'lifetime'>
  ): Resource<T> {
    const previous = this.entries.get(domain);
    if (
      previous &&
      Object.entries(dependencies).every(([key, value]) => previous.dependencies[key as Domain] === value)
    )
      return previous.resource as Resource<T>;
    if (previous) {
      previous.resource.lifetime.dispose();
      previous.resource.dispose();
    }
    const lifetime = new Lifetime(() => this.active);
    const resource = { ...create(lifetime), lifetime };
    this.entries.set(domain, { resource, dependencies });
    return resource;
  }
  mount(name: string, token: symbol) {
    if (this.mounted.has(name) && this.mounted.get(name) !== token)
      throw new Error(
        `Only one ${name} may be mounted in a StudioProvider. Use a separate provider for another instance.`
      );
    this.mounted.set(name, token);
    return () => {
      if (this.mounted.get(name) === token) this.mounted.delete(name);
    };
  }
}
