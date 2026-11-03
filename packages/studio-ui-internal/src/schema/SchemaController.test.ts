import { afterEach, describe, expect, it, vi } from 'vitest';
import { observable, runInAction } from 'mobx';

import SchemaStore from './SchemaController';

describe('SchemaStore session reaction', () => {
  let store: SchemaStore;

  afterEach(() => {
    store.destroy();
  });

  it.each([false, true])('keeps standalone metadata in sync (host callback returns undefined: %s)', async (attach) => {
    store = new SchemaStore({ execute: vi.fn().mockResolvedValue({ code: 0 }) });
    if (attach) store.attach({ getCurrentSchemaPath: () => undefined });
    store.updateCurrentSchame({ path: '/first' });
    const first = { name: 'first', path: '/first', owner: 'first-owner' };
    const second = { name: 'second', path: '/second', owner: 'second-owner' };
    store.updateSchemas([first, second]);
    expect(store.currentSchema.owner).toBe('first-owner');

    store.updateSchemas([{ ...first, owner: 'updated-owner' }, second]);
    expect(store.currentSchema.owner).toBe('updated-owner');

    await store.switchSchema('/second');
    expect(store.currentSchema.path).toBe('/second');
    store.updateSchemas([first, { ...second, owner: 'updated-second-owner' }]);
    expect(store.currentSchema.owner).toBe('updated-second-owner');

    store.reset();
    store.updateCurrentSchame({ path: '/first' });
    store.updateSchemas([first]);
    store.updateSchemas([{ ...first, owner: 'owner-after-reset' }]);
    expect(store.currentSchema.owner).toBe('owner-after-reset');
  });

  it('follows the current host after reattachment and continues refreshing metadata', () => {
    store = new SchemaStore({ execute: vi.fn() });
    const firstHost = observable({ path: '/first' });
    const secondHost = observable({ path: '/first' });
    const first = { name: 'first', path: '/first', owner: 'first-owner' };
    const second = { name: 'second', path: '/second', owner: 'second-owner' };
    store.attach({ getCurrentSchemaPath: () => firstHost.path });
    store.updateSchemas([first, second]);
    expect(store.currentSchema.path).toBe('/first');

    store.attach({ getCurrentSchemaPath: () => secondHost.path });
    runInAction(() => {
      firstHost.path = '/second';
    });
    expect(store.currentSchema.path).toBe('/first');
    runInAction(() => {
      secondHost.path = '/second';
    });
    expect(store.currentSchema.path).toBe('/second');
    expect(store.currentSchema.owner).toBe('second-owner');

    store.updateSchemas([first, { ...second, owner: 'updated-owner' }]);
    expect(store.currentSchema.owner).toBe('updated-owner');
  });

  it('reads the selected schema from the host callback', () => {
    store = new SchemaStore({ execute: vi.fn() });
    store.attach({
      getCurrentSchemaPath: () => '/schema/demo',
    });

    expect(store.currentSchemaPath).toBe('/schema/demo');
  });

  it('keeps a single reaction after reset is called twice', () => {
    store = new SchemaStore({ execute: vi.fn() });
    store.attach({
      getCurrentSchemaPath: () => '/s',
    });
    const updateCurrentSchame = store.updateCurrentSchame;
    let calls = 0;
    store.updateCurrentSchame = (schema) => {
      calls += 1;
      updateCurrentSchame(schema);
    };

    runInAction(() => {
      store.schemas.replace([{ name: 's', path: '/s', owner: 'root' }]);
    });
    expect(calls).toBe(1);

    store.reset();
    store.reset();
    expect(store.reactionDisposer).toBeTypeOf('function');
    expect(store.schemas).toHaveLength(0);

    calls = 0;
    runInAction(() => {
      store.schemas.replace([{ name: 's', path: '/s', owner: 'root' }]);
    });
    expect(calls).toBe(1);
  });
});

describe('catalog request isolation', () => {
  it.each(['success', 'failure'])('ignores a late graph-list %s from before creation', async (outcome) => {
    let finish!: (value: unknown) => void;
    let fail!: (error: Error) => void;
    const oldGraph = { graph: 'old', graph_type: 'type', owner: '', schema: '/one', index_cnt: 0 };
    const newGraph = { ...oldGraph, graph: 'new' };
    const execute = vi.fn().mockResolvedValue({ code: 0, data: { tables: [oldGraph, newGraph] } });
    execute.mockReturnValueOnce(
      new Promise((resolve, reject) => {
        finish = resolve;
        fail = reject;
      })
    );
    const store = new SchemaStore({ execute });
    store.updateCurrentSchame({ path: '/one' });
    try {
      const stale = store.updateGraphsBySchema().catch((error: Error) => error.name);
      await store.createGraph('new', 'type');
      const fresh = store.updateGraphsBySchema();
      expect(execute.mock.calls.filter(([gql]) => gql.startsWith('call show_graphs()'))).toHaveLength(2);
      await fresh;
      expect(store.currentSchema.graphs.map(({ graph }) => graph)).toEqual(['old', 'new']);
      if (outcome === 'success') finish({ code: 0, data: { tables: [oldGraph] } });
      else fail(new Error('Old request failed'));
      await expect(stale).resolves.toBe('AbortError');
      expect(store.currentSchema.graphs.map(({ graph }) => graph)).toEqual(['old', 'new']);
    } finally {
      store.destroy();
    }
  });

  it('keeps current-schema discovery active when creating another schema', async () => {
    let finish!: (value: unknown) => void;
    const execute = vi.fn().mockResolvedValue({ code: 0 });
    execute.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const store = new SchemaStore({ execute });
    try {
      const discovery = store.refreshCurrentSchema();
      await store.createSchema('/new');
      finish({ code: 0, data: { tables: [{ name: 'one', path: '/one', owner: '' }] } });
      await discovery;
      expect(store.currentSchema.path).toBe('/one');
    } finally {
      store.destroy();
    }
  });

  it('does not commit a pre-write list while its response handlers are completing', async () => {
    let finish!: (value: unknown) => void;
    const execute = vi.fn().mockResolvedValue({ code: 0 });
    execute.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const store = new SchemaStore({ execute });
    try {
      const pending = store.updateGraphsBySchema().catch(() => {});
      finish({ code: 0, data: { tables: [{ graph: 'old' }] } });
      await store.createGraph('new', 'type');
      await pending;
      expect(store.currentSchema.graphs).toEqual([]);
    } finally {
      store.destroy();
    }
  });

  it.each(['createSchema', 'dropSchema'] as const)(
    'refreshes schemas after %s without reusing pre-write data',
    async (operation) => {
      let finish!: (value: unknown) => void;
      const schemas = [{ name: 'new', path: '/new', owner: '' }];
      const execute = vi.fn().mockResolvedValue({ code: 0, data: { tables: schemas } });
      execute.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      );
      const store = new SchemaStore({ execute });
      try {
        const stale = store.getSchemas().catch((error: Error) => error.name);
        await store[operation]('/new');
        const fresh = store.getSchemas();
        expect(execute.mock.calls.filter(([gql]) => gql === 'SHOW SCHEMAS')).toHaveLength(2);
        await fresh;
        finish({ code: 0, data: { tables: [{ name: 'old', path: '/old', owner: '' }] } });
        await expect(stale).resolves.toBe('AbortError');
        expect(store.schemas.map(({ path }) => path)).toEqual(['/new']);
      } finally {
        store.destroy();
      }
    }
  );

  it('retains request sharing when a catalog mutation fails', async () => {
    let finish!: (value: unknown) => void;
    const execute = vi.fn().mockResolvedValue({ code: 1, message: 'creation failed' });
    execute.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const store = new SchemaStore({ execute });
    try {
      const original = store.updateGraphsBySchema();
      await store.createGraph('new', 'type');
      const shared = store.updateGraphsBySchema();
      expect(execute.mock.calls.filter(([gql]) => gql.startsWith('call show_graphs()'))).toHaveLength(1);
      finish({ code: 0, data: { tables: [] } });
      await Promise.all([original, shared]);
    } finally {
      store.destroy();
    }
  });

  it('ignores graph lists that resolve after a schema change', async () => {
    let complete!: (value: unknown) => void;
    const execute = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    const store = new SchemaStore({ execute });
    store.updateCurrentSchame({ path: '/first' });
    const pending = store.updateGraphTypesBySchema();
    const signal = execute.mock.calls[0][1].signal as AbortSignal;
    store.updateCurrentSchame({ path: '/second' });
    complete({ code: 0, data: { tables: [{ graph_type: 'old' }] } });
    await pending;
    expect(signal.aborted).toBe(true);
    expect(store.currentSchema.path).toBe('/second');
    expect(store.currentSchema.graphTypes).toEqual([]);
    store.destroy();
  });

  it('ignores late schema discovery after logout without clearing another instance', async () => {
    let complete!: (value: unknown) => void;
    const first = new SchemaStore({
      execute: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          complete = resolve;
        })
      ),
    });
    const second = new SchemaStore({ execute: vi.fn() });
    second.updateSchemas([{ name: 'second', path: '/second', owner: 'user' }]);
    const pending = first.getSchemas();
    first.reset();
    complete({ code: 0, data: { tables: [{ name: 'first', path: '/first', owner: 'user' }] } });
    await pending;
    expect(first.schemas).toHaveLength(0);
    expect(second.schemas).toHaveLength(1);
    first.destroy();
    second.destroy();
  });
});

describe('schema switch ordering', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    return { promise, resolve, reject };
  }
  const success = { code: 0, message: '' };

  it.each([false, true])('serializes session changes (host service: %s)', async (useHostService) => {
    const firstResponse = deferred<typeof success>();
    const secondResponse = deferred<typeof success>();
    let serverSchema = '/initial';
    const switchSession = vi.fn((path: string) => {
      const response = path === '/first' ? firstResponse : secondResponse;
      return response.promise.then((result) => {
        serverSchema = path;
        return result;
      });
    });
    const store = new SchemaStore({
      execute: vi.fn((gql: string) => switchSession(gql.includes('/first') ? '/first' : '/second')),
      ...(useHostService ? { switchSchema: switchSession } : {}),
    });
    store.updateCurrentSchame({ path: '/initial' });
    try {
      const first = store.switchSchema('/first');
      const second = store.switchSchema('/second');
      expect(store.switchingSchema).toBe(true);
      await vi.waitFor(() => expect(switchSession).toHaveBeenCalledTimes(1));
      firstResponse.resolve(success);
      await first;
      expect(store.currentSchema.path).toBe(serverSchema);
      expect(store.switchingSchema).toBe(true);
      await vi.waitFor(() => expect(switchSession).toHaveBeenCalledTimes(2));
      secondResponse.resolve(success);
      await second;
      expect(serverSchema).toBe('/second');
      expect(store.currentSchema.path).toBe(serverSchema);
      expect(store.switchingSchema).toBe(false);
    } finally {
      store.destroy();
    }
  });

  it.each(['reject', 'error response'])('continues the queue after an earlier %s', async (failure) => {
    const firstResponse = deferred<typeof success>();
    const switchSchema = vi.fn().mockReturnValueOnce(firstResponse.promise).mockResolvedValue(success);
    const store = new SchemaStore({ execute: vi.fn(), switchSchema });
    store.updateCurrentSchame({ path: '/initial' });
    try {
      const first = store.switchSchema('/first');
      const firstResult = first.catch((error) => error);
      const second = store.switchSchema('/second');
      if (failure === 'reject') firstResponse.reject(new Error('transport failure'));
      else firstResponse.resolve({ code: 1, message: 'switch failed' });
      await firstResult;
      await second;
      expect(store.currentSchema.path).toBe('/second');
      expect(store.switchingSchema).toBe(false);
    } finally {
      store.destroy();
    }
  });

  it('cancels queued switches on reset without clearing a new session request', async () => {
    const oldResponse = deferred<typeof success>();
    const newResponse = deferred<typeof success>();
    const switchSchema = vi.fn().mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise);
    const store = new SchemaStore({ execute: vi.fn(), switchSchema });
    try {
      const first = store.switchSchema('/old-first').catch((error: Error) => error.name);
      const second = store.switchSchema('/old-second').catch((error: Error) => error.name);
      await vi.waitFor(() => expect(switchSchema).toHaveBeenCalledOnce());
      store.reset();
      const next = store.switchSchema('/new-session');
      await vi.waitFor(() => expect(switchSchema).toHaveBeenCalledTimes(2));
      oldResponse.resolve(success);
      expect(await first).toBe('AbortError');
      expect(await second).toBe('AbortError');
      expect(switchSchema.mock.calls.map(([path]) => path)).toEqual(['/old-first', '/new-session']);
      expect(store.switchingSchema).toBe(true);
      newResponse.resolve(success);
      await next;
      expect(store.currentSchema.path).toBe('/new-session');
      expect(store.switchingSchema).toBe(false);
    } finally {
      store.destroy();
    }
  });

  it('accepts a host service that synchronizes the schema before returning', async () => {
    const store = new SchemaStore({
      execute: vi.fn(),
      switchSchema: async (path) => {
        store.updateCurrentSchame({ path });
        return success;
      },
    });
    try {
      await expect(store.switchSchema('/host-schema')).resolves.toEqual(success);
      expect(store.currentSchema.path).toBe('/host-schema');
    } finally {
      store.destroy();
    }
  });
});
