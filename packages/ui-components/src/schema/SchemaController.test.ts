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
