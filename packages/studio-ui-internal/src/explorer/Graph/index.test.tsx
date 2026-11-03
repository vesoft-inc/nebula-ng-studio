// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { UiProvider } from '../../provider';
import SchemaController from '../../schema/SchemaController';
import { ExplorerStore } from '../ExplorerController';
import { ExplorerStoreProvider } from '../context';
import { StudioShell } from '../../shell/StudioShell';
import ExplorerGraph from './index';
import type { ExplorerGraphProps } from './index';

vi.mock('../../graph/utils/layouts', () => ({ default: {} }));
vi.mock('./Content', async () => {
  const { default: Minimap } = await import('../../graph/components/Minimap');
  const { useExplorerStore } = await import('../context');
  const { observer } = await import('mobx-react-lite');
  return {
    default: observer(function Content() {
      const { graphWorkspace } = useExplorerStore();
      return (
        <section aria-label={`Snapshot ${graphWorkspace.explorerId}`}>
          <Minimap explorerItem={graphWorkspace}>
            {({ minimapToggleButton }) => <div data-testid="minimap-toggle">{minimapToggleButton}</div>}
          </Minimap>
        </section>
      );
    }),
  };
});
vi.mock('./SiderTools', () => ({ default: () => null }));
vi.mock('../../graph/components/RightSideTool', () => ({ default: () => null }));
vi.mock('./Header', () => ({
  default: ({ onBack, blocker }: ExplorerGraphProps) => (
    <>
      <button onClick={onBack}>Back</button>
      {blocker?.state === 'blocked' && <button onClick={blocker.proceed}>Leave</button>}
    </>
  ),
}));
afterEach(cleanup);
it('reports dirty changes and delegates navigation without selecting another page', async () => {
  const schema = new SchemaController({ execute: vi.fn() });
  const controller = new ExplorerStore({
    schemaStore: schema,
    services: { execute: vi.fn(), snapshots: {} as never },
    settings: {},
  });
  controller.openSnapshot = async (_id, workspace) => {
    controller.updateGraphWorkspace(workspace);
  };
  const first = vi.fn();
  const second = vi.fn();
  const back = vi.fn();
  const proceed = vi.fn();
  const host = (callback: (dirty: boolean) => void, blocked = false) => (
    <UiProvider>
      <ExplorerStoreProvider value={controller}>
        <ExplorerGraph
          snapshotId="snapshot"
          onDirtyChange={callback}
          onBack={back}
          blocker={{ state: blocked ? 'blocked' : 'unblocked', proceed }}
        />
      </ExplorerStoreProvider>
    </UiProvider>
  );
  const view = render(host(first));
  try {
    await screen.findByText('Back');
    act(() => controller.graphWorkspace!.graph.updateShouldBlockRouter(true));
    await waitFor(() => expect(first).toHaveBeenLastCalledWith(true));
    first.mockClear();
    view.rerender(host(second));
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Back'));
    expect(back).toHaveBeenCalledOnce();
    expect(screen.getByText('Back')).toBeTruthy();
    view.rerender(host(second, true));
    fireEvent.click(screen.getByText('Leave'));
    expect(proceed).toHaveBeenCalledOnce();
    act(() => controller.graphWorkspace!.graph.updateShouldBlockRouter(false));
    expect(second).toHaveBeenLastCalledWith(false);
    act(() => controller.graphWorkspace!.graph.updateShouldBlockRouter(true));
    view.unmount();
    expect(second).toHaveBeenLastCalledWith(false);
    expect(controller.graphWorkspace).toBeUndefined();
  } finally {
    view.unmount();
    controller.destroy();
    schema.destroy();
  }
});

it('releases the previous snapshot and keeps minimap dragging bound to the current canvas', async () => {
  const schema = new SchemaController({ execute: vi.fn() });
  const controller = new ExplorerStore({
    schemaStore: schema,
    services: { execute: vi.fn(), snapshots: {} as never },
    settings: {},
  });
  const centers = new Map<string, ReturnType<typeof vi.fn>>();
  // Replace the rendering engine; workspace disposal and minimap event handlers remain real.
  controller.openSnapshot = async (id, workspace) => {
    const centerAt = vi.fn();
    centers.set(id, centerAt);
    workspace.graph.unsafeAction((graph) => {
      graph.rect = { width: 640, height: 480 };
      graph.twoGraph = {
        instance: { zoom: () => 1, centerAt },
        transform: { x: 0, y: 0, k: 1 },
        destroy: vi.fn(),
      } as never;
    });
    workspace.minimap.initGraph = () => {
      workspace.graph.unsafeAction(() => {
        workspace.minimap.graph = {
          screen2GraphCoords: (x: number, y: number) => ({ x, y }),
          _destructor: vi.fn(),
        } as never;
        workspace.minimap.width = 320;
        workspace.minimap.height = 240;
      });
    };
    controller.updateGraphWorkspace(workspace);
  };
  const host = (id: string) => (
    <UiProvider renderGlobalModal={false}>
      <ExplorerStoreProvider value={controller}>
        <ExplorerGraph snapshotId={id} />
      </ExplorerStoreProvider>
    </UiProvider>
  );
  const view = render(host('first'));
  const errors = vi.fn((event: ErrorEvent) => event.preventDefault());
  window.addEventListener('error', errors);
  const findDragHandle = () =>
    Array.from(view.container.querySelectorAll('div')).find((element) => getComputedStyle(element).cursor === 'move');
  const dragMinimap = () => {
    if (!findDragHandle()) fireEvent.click(screen.getByTestId('minimap-toggle').querySelector('button')!);
    const handle = findDragHandle();
    expect(handle).toBeTruthy();
    fireEvent.mouseDown(handle!, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 130, clientY: 130 });
    fireEvent.mouseUp(document);
  };
  try {
    await screen.findByRole('region', { name: 'Snapshot first' });
    const previous = controller.graphWorkspace;
    dragMinimap();
    expect(centers.get('first')).toHaveBeenCalledOnce();
    view.rerender(host('second'));
    await screen.findByRole('region', { name: 'Snapshot second' });
    expect(controller.graphWorkspace).not.toBe(previous);
    expect(previous.graph.twoGraph).toBeUndefined();
    dragMinimap();
    expect(errors).not.toHaveBeenCalled();
    expect(centers.get('first')).toHaveBeenCalledOnce();
    expect(centers.get('second')).toHaveBeenCalledOnce();
  } finally {
    view.unmount();
    controller.destroy();
    schema.destroy();
    window.removeEventListener('error', errors);
  }
});

it('contains the loading overlay within the graph without covering host navigation', async () => {
  const schema = new SchemaController({ execute: vi.fn() });
  const controller = new ExplorerStore({
    schemaStore: schema,
    services: { execute: vi.fn(), snapshots: {} as never },
    settings: {},
  });
  controller.openSnapshot = async (_id, workspace) => controller.updateGraphWorkspace(workspace);
  const view = render(
    <UiProvider renderGlobalModal={false}>
      <StudioShell header={<nav>Studio navigation</nav>}>
        <ExplorerStoreProvider value={controller}>
          <ExplorerGraph snapshotId="snapshot" />
        </ExplorerStoreProvider>
      </StudioShell>
    </UiProvider>
  );
  try {
    const graph = (await screen.findByText('Back')).parentElement!;
    act(() => controller.updateLoading(true));
    const overlay = graph.querySelector('img')!.parentElement!.parentElement!;
    expect(getComputedStyle(overlay).position).toBe('absolute');
    let containingBlock = overlay.parentElement;
    while (
      containingBlock &&
      !['relative', 'absolute', 'fixed', 'sticky'].includes(getComputedStyle(containingBlock).position)
    ) {
      containingBlock = containingBlock.parentElement;
    }
    expect(containingBlock).toBe(graph);
    expect(containingBlock?.contains(screen.getByRole('navigation'))).toBe(false);
    act(() => controller.updateLoading(false));
    expect(graph.contains(overlay)).toBe(false);
  } finally {
    view.unmount();
    controller.destroy();
    schema.destroy();
  }
});
