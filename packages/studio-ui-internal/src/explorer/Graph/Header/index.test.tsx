// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeObject } from '@vesoft-inc/force-graph';
import { UiProvider } from '../../../provider';
import { GraphWorkspaceStore } from '../../../graph/stores/workspace';
import type { TwoGraphStore } from '../../../graph/stores/two-graph';
import { RawEntityType } from '../../../graph/types/gql';
import { ConditionFilter } from '../../../graph/types/explorer';
import { OperatorType } from '../../../graph/constants';
import SchemaController from '../../../schema/SchemaController';
import { ExplorerStore } from '../../ExplorerController';
import { ExplorerStoreProvider } from '../../context';
import type { ExplorerNavigationBlocker, SnapshotServices } from '../../services';
import GraphHeader from './index';

vi.mock('../../../graph/utils/layouts', () => ({ default: {} }));
vi.mock('../EditToolbar/index', () => ({ EditModeToggle: () => null }));

const controllers: ExplorerStore[] = [];
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
});
afterEach(() => {
  cleanup();
  controllers.splice(0).forEach((controller) => {
    controller.destroy();
    controller.schemaStore.destroy();
  });
  vi.restoreAllMocks();
});

function setup(blocker?: ExplorerNavigationBlocker) {
  const pending: { resolve: (response: { code: number; message: string }) => void; reject: (error: Error) => void }[] =
    [];
  const update = vi.fn<SnapshotServices['update']>(
    () =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      })
  );
  const services = {
    execute: vi.fn(),
    snapshots: { list: vi.fn(), create: vi.fn(), read: vi.fn(), delete: vi.fn(), update },
  };
  const schemaStore = new SchemaController(services);
  schemaStore.updateCurrentSchame({ path: '/demo' });
  const controller = new ExplorerStore({ services, schemaStore, settings: {} });
  controllers.push(controller);
  const workspace = new GraphWorkspaceStore({ explorerId: 'snapshot', execGql: services.execute });
  controller.updateGraphWorkspace(workspace);
  workspace.updateCurrentSnapshot({
    id: 'snapshot',
    name: 'Test',
    graph: 'demo',
    graph_type: '',
    schemaPath: '/demo',
    created_at: '',
    updated_at: '',
  });
  const graph = workspace.graph;
  graph.twoGraph = {
    canvas: document.createElement('canvas'),
    instance: { zoom: vi.fn(() => 1), centerAt: vi.fn(() => ({ x: 0, y: 0 })), zoomToFit: vi.fn() },
    render: vi.fn(),
    destroy: vi.fn(),
  } as unknown as TwoGraphStore;
  const node = {
    id: '1',
    color: 'red',
    data: {
      type: RawEntityType.NODE,
      raw: '1',
      value: { id: 1, graph: 'demo', type: 'Person', labels: [], properties: {} },
    },
  } as NodeObject;
  graph.initData({ nodes: [node] });
  graph.pushHistory();
  graph.selectNodes([node]);
  graph.updateShouldBlockRouter(true);
  render(
    <UiProvider locale="en_US">
      <ExplorerStoreProvider value={controller}>
        <GraphHeader blocker={blocker} />
      </ExplorerStoreProvider>
    </UiProvider>
  );
  return { graph, controller, update, pending };
}

describe('snapshot save consistency', () => {
  it.each(['color', 'undo', 'filter', 'properties', 'delete'] as const)(
    'keeps %s edits made after the save request dirty',
    async (change) => {
      const { graph, update, pending } = setup();
      fireEvent.click(screen.getByTitle('Save'));
      await waitFor(() => expect(update).toHaveBeenCalledOnce());
      expect(JSON.parse(update.mock.calls[0][0].data!).nowDataMap['1'].color).toBe('red');
      act(() => {
        if (change === 'color') graph.changeNodesSelectedColor({ color: 'blue' });
        if (change === 'undo') graph.undo();
        if (change === 'filter')
          graph.updateFilterList([new ConditionFilter({ operator: OperatorType.Equal, value: '1', enable: false })]);
        if (change === 'properties')
          graph.updateNodeDisplayedPropertyItems([{ type_name: 'Person', properties: ['name'] }]);
        if (change === 'delete') graph.removeEntities({ nodes: Array.from(graph.nodes) });
      });
      await act(async () => pending[0].resolve({ code: 0, message: '' }));
      expect(graph.shouldBlockRouter).toBe(true);
      expect(screen.getByText(/newer changes are still unsaved/)).toBeTruthy();
    }
  );

  it('clears the dirty flag only after the current revision is saved', async () => {
    const { graph, update, pending } = setup();
    fireEvent.click(screen.getByTitle('Save'));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    await act(async () => pending[0].resolve({ code: 0, message: '' }));
    expect(graph.shouldBlockRouter).toBe(false);
  });

  it('keeps Save & Leave blocked until a subsequent save includes the newer edits', async () => {
    const blocker = { state: 'blocked', proceed: vi.fn(), reset: vi.fn() };
    const { graph, update, pending } = setup(blocker);
    fireEvent.click(screen.getByRole('button', { name: 'Save & Leave' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    act(() => graph.changeNodesSelectedColor({ color: 'blue' }));
    await act(async () => pending[0].resolve({ code: 0, message: '' }));
    expect(graph.shouldBlockRouter).toBe(true);
    expect(blocker.proceed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Leave' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(JSON.parse(update.mock.calls[1][0].data!).nowDataMap['1'].color).toBe('blue');
    await act(async () => pending[1].resolve({ code: 0, message: '' }));
    expect(graph.shouldBlockRouter).toBe(false);
    expect(blocker.proceed).toHaveBeenCalledOnce();
  });

  it.each(['transport', 'response'] as const)(
    'preserves edits and permits retry after a %s failure',
    async (failure) => {
      const { graph, update, pending } = setup();
      fireEvent.click(screen.getByTitle('Save'));
      await waitFor(() => expect(update).toHaveBeenCalledOnce());
      await act(async () => {
        if (failure === 'transport') pending[0].reject(new Error('network unavailable'));
        else pending[0].resolve({ code: 1, message: 'failed' });
      });
      expect(graph.shouldBlockRouter).toBe(true);
      expect((screen.getByTitle('Save') as HTMLButtonElement).disabled).toBe(false);
    }
  );
});
