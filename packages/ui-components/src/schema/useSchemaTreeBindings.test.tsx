// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { GraphEntityType, type ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { UiProvider } from '../provider';
import ModalStore from '../shared/Modal/ModalStore';
import { SchemaItemType } from '../shared/constants';
import type { QueryExecutor } from '../shared/query';
import SchemaController from './SchemaController';
import { useSchemaTreeBindings, type SchemaTreeBindingsOptions } from './useSchemaTreeBindings';

const controllers: SchemaController[] = [];
afterEach(() => {
  cleanup();
  controllers.splice(0).forEach((controller) => controller.destroy());
});

function setup(options: Partial<Omit<SchemaTreeBindingsOptions, 'controller'>> = {}) {
  const execute = vi.fn<QueryExecutor>().mockResolvedValue({ code: 0, message: '', data: { tables: [] } });
  const switchSchema = vi.fn().mockResolvedValue({ code: 0, message: '' });
  const controller = new SchemaController({ execute: execute as QueryExecutor, switchSchema });
  controllers.push(controller);
  controller.updateCurrentSchame({ path: '/initial' });
  const modalStore = new ModalStore();
  const onSchemaChange = vi.fn();
  const onSchemaCreated = vi.fn();
  const bindings = renderHook(
    ({ currentController }) =>
      useSchemaTreeBindings({
        controller: currentController,
        onViewAllSchemas: vi.fn(),
        onSchemaChange,
        onSchemaCreated,
        ...options,
      }),
    {
      initialProps: { currentController: controller },
      wrapper: ({ children }: { children: ReactNode }) => (
        <UiProvider locale="en_US" modalStore={modalStore} renderGlobalModal={false} cssBaseline={false}>
          {children}
        </UiProvider>
      ),
    }
  );
  return { ...bindings, controller, execute, switchSchema, modalStore, onSchemaChange, onSchemaCreated };
}

it('binds a supplied controller without a router, a SchemaProvider, or implicit initial requests', () => {
  const { result, controller, execute } = setup();
  expect(result.current.schema).toBe(controller.currentSchema);
  expect(result.current.selector.schemaLabel).toBe('initial');
  expect(result.current.showDetail).toBe(true);
  expect(result.current.onReady).toBeUndefined();
  expect(execute).not.toHaveBeenCalled();
});

it('loads detail names from node data instead of splitting presentation keys', async () => {
  const { result, controller, execute } = setup();
  const entity = {
    entity_type: GraphEntityType.Node,
    type_name: 'book-node',
    graph_type_name: 'book-type',
    labels: [],
    properties: [],
    'primary_key/multiedge_key': ['id'],
  };
  const graphType = { schema: '/initial', graph_type: 'book-type', owner: '', entities: [entity] };
  controller.updateCurrentSchame({ graphTypes: [graphType] });
  execute.mockResolvedValueOnce({ code: 0, message: '', data: { tables: [entity] } });
  await result.current.onLoadNode({
    key: 'presentation-key',
    title: 'Unrelated label',
    rawData: { type: SchemaItemType.GraphTypeDescItem, graphType },
  });
  await result.current.onLoadNode({
    key: 'another-presentation-key',
    title: 'Unrelated label',
    rawData: { type: SchemaItemType.EntityTypeDescItem, entity },
  });

  expect(execute.mock.calls.map(([gql]) => gql)).toEqual([
    'DESCRIBE GRAPH TYPE `book-type`',
    'DESCRIBE NODE TYPE `book-node` OF `book-type` ',
  ]);
});

it('skips detail queries when disabled while still loading graph categories', async () => {
  const { result, execute } = setup({ showDetail: false });
  await result.current.onLoadNode({
    key: 'detail',
    title: 'Detail',
    rawData: {
      type: SchemaItemType.GraphTypeDescItem,
      graphType: { schema: '/initial', graph_type: 'book-type', owner: '', entities: [] },
    },
  });
  expect(execute).not.toHaveBeenCalled();

  await result.current.onLoadNode({ key: 'graphs', title: 'Graphs', rawData: { type: SchemaItemType.Graph } });
  await result.current.onLoadNode({ key: 'types', title: 'Types', rawData: { type: SchemaItemType.GraphType } });
  expect(execute.mock.calls.map(([gql]) => gql)).toEqual([
    expect.stringContaining('show_graphs()'),
    'SHOW GRAPH TYPES',
  ]);
});

it('notifies the host and provider only after a successful schema switch', async () => {
  const { result, switchSchema, controller, onSchemaChange, modalStore } = setup();
  let finish!: (response: ServerResponse<object>) => void;
  switchSchema.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const pending = result.current.selector.onSwitchSchema({ path: '/next', name: 'next', owner: '' });
  expect(onSchemaChange).not.toHaveBeenCalled();
  expect(modalStore.message.list).toHaveLength(0);

  await act(async () => {
    finish({ code: 0, message: '' });
    await expect(pending).resolves.toBe(true);
  });
  expect(controller.currentSchema.path).toBe('/next');
  expect(onSchemaChange).toHaveBeenCalledOnce();
  expect(onSchemaChange).toHaveBeenCalledWith('/next');
  expect(modalStore.message.list).toHaveLength(1);
  expect(modalStore.message.list[0].type).toBe('success');
});

it('keeps host state and messages unchanged after failed or rejected switches', async () => {
  const { result, switchSchema, onSchemaChange, modalStore } = setup();
  switchSchema.mockResolvedValueOnce({ code: 500, message: 'failed' });
  await expect(result.current.selector.onSwitchSchema({ path: '/next', name: 'next', owner: '' })).resolves.toBe(false);
  switchSchema.mockRejectedValueOnce(new Error('offline'));
  await expect(result.current.selector.onSwitchSchema({ path: '/next', name: 'next', owner: '' })).rejects.toThrow(
    'offline'
  );
  expect(onSchemaChange).not.toHaveBeenCalled();
  expect(modalStore.message.list).toHaveLength(0);
});

it('refreshes the schema list before notifying the host of creation', async () => {
  const { result, execute, controller, onSchemaCreated } = setup();
  let finish!: (response: ServerResponse<object>) => void;
  execute.mockResolvedValueOnce({ code: 0, message: '' });
  execute.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const pending = result.current.selector.onCreateSchema('/new');
  await act(async () => {
    await Promise.resolve();
  });
  expect(onSchemaCreated).not.toHaveBeenCalled();

  await act(async () => {
    finish({ code: 0, message: '', data: { tables: [{ path: '/new', name: 'new', owner: '' }] } });
    await expect(pending).resolves.toBe(true);
  });
  expect(controller.schemas.map((schema) => schema.path)).toEqual(['/new']);
  expect(onSchemaCreated).toHaveBeenCalledOnce();
  expect(onSchemaCreated).toHaveBeenCalledWith('/new');
});

it('does not refresh or notify the host when schema creation fails', async () => {
  const { result, execute, onSchemaCreated } = setup();
  execute.mockResolvedValueOnce({ code: 500, message: 'failed' });
  await expect(result.current.selector.onCreateSchema('/new')).resolves.toBe(false);
  expect(execute.mock.calls.map(([gql]) => gql)).toEqual(['CREATE SCHEMA `/new`']);
  expect(onSchemaCreated).not.toHaveBeenCalled();
});

it('keeps a successful creation successful when the subsequent list refresh rejects', async () => {
  const { result, execute, onSchemaCreated } = setup();
  execute.mockResolvedValueOnce({ code: 0, message: '' });
  execute.mockRejectedValueOnce(new Error('list refresh unavailable'));

  await expect(result.current.selector.onCreateSchema('/new')).resolves.toBe(true);
  expect(execute.mock.calls.map(([gql]) => gql)).toEqual(['CREATE SCHEMA `/new`', 'SHOW SCHEMAS']);
  expect(onSchemaCreated).toHaveBeenCalledOnce();
  expect(onSchemaCreated).toHaveBeenCalledWith('/new');
});

it.each([true, false])(
  'does not notify after unmount during the list refresh (refresh succeeds: %s)',
  async (success) => {
    const { result, execute, onSchemaCreated, unmount } = setup();
    let finish!: (response: ServerResponse<object>) => void;
    let fail!: (error: Error) => void;
    execute.mockResolvedValueOnce({ code: 0, message: '' });
    execute.mockReturnValueOnce(
      new Promise((resolve, reject) => {
        finish = resolve;
        fail = reject;
      })
    );
    const pending = result.current.selector.onCreateSchema('/new');
    await act(async () => {
      await Promise.resolve();
    });
    expect(execute.mock.calls.map(([gql]) => gql)).toContain('SHOW SCHEMAS');

    unmount();
    if (success) finish({ code: 0, message: '', data: { tables: [] } });
    else fail(new Error('list refresh unavailable'));

    await expect(pending).resolves.toBe(true);
    expect(onSchemaCreated).not.toHaveBeenCalled();
  }
);

it('skips follow-up work when creation finishes after unmount', async () => {
  const { result, execute, onSchemaCreated, unmount } = setup();
  let finish!: (response: ServerResponse<object>) => void;
  execute.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const pending = result.current.selector.onCreateSchema('/new');
  unmount();
  finish({ code: 0, message: '' });

  await expect(pending).resolves.toBe(true);
  expect(execute.mock.calls.map(([gql]) => gql)).toEqual(['CREATE SCHEMA `/new`']);
  expect(onSchemaCreated).not.toHaveBeenCalled();
});

it('does not revive an old creation when its controller is replaced and restored', async () => {
  const { result, execute, controller, onSchemaCreated, rerender } = setup();
  const replacement = new SchemaController({ execute: execute as QueryExecutor });
  controllers.push(replacement);
  let finish!: (response: ServerResponse<object>) => void;
  execute.mockResolvedValueOnce({ code: 0, message: '' });
  execute.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const pending = result.current.selector.onCreateSchema('/new');
  await act(async () => {
    await Promise.resolve();
  });

  rerender({ currentController: replacement });
  rerender({ currentController: controller });
  finish({ code: 0, message: '', data: { tables: [] } });

  await expect(pending).resolves.toBe(true);
  expect(onSchemaCreated).not.toHaveBeenCalled();
});

it('keeps controllers and provider messages isolated between consumers', async () => {
  const first = setup();
  const second = setup();
  await act(async () => {
    await first.result.current.selector.onSwitchSchema({ path: '/first', name: 'first', owner: '' });
  });
  expect(first.controller.currentSchema.path).toBe('/first');
  expect(first.modalStore.message.list).toHaveLength(1);
  expect(second.controller.currentSchema.path).toBe('/initial');
  expect(second.modalStore.message.list).toHaveLength(0);
  expect(second.onSchemaChange).not.toHaveBeenCalled();
});
