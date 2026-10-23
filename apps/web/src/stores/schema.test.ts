import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInAction } from 'mobx';

vi.mock('@studio/services', () => ({
  execGql: vi.fn(),
  changeSchema: vi.fn(),
  importDataParams: vi.fn(),
  resolveSchemaPath: vi.fn(),
  sweepStaleGraphTypeLayouts: vi.fn(),
}));

import SchemaStore from './schema';

describe('SchemaStore session reaction', () => {
  let store: SchemaStore;

  afterEach(() => {
    store.reactionDisposer?.();
    store.reactionDisposer = undefined;
  });

  it('reads userInfo from attach instead of a root store', () => {
    store = new SchemaStore();
    store.attach({
      commonStore: { userInfo: { curSchemaPath: '/schema/demo', address: '127.0.0.1', username: 'root' } },
    });

    expect(store.userInfo).toMatchObject({ curSchemaPath: '/schema/demo', username: 'root' });
  });

  it('keeps a single reaction after reset is called twice', () => {
    store = new SchemaStore();
    store.attach({
      commonStore: { userInfo: { curSchemaPath: '/s' } },
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
