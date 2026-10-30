// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { observable, runInAction } from 'mobx';
import { afterEach, expect, it, vi } from 'vitest';
import { ExplorerWorkbench } from './ExplorerWorkbench';
import type { ExplorerStore } from './ExplorerController';
import type { ExplorerGraphProps } from './Graph';
import { UiProvider } from '../provider';

vi.mock('./Graph', () => ({
  default: ({ onBack, blocker }: ExplorerGraphProps) => (
    <>
      <button onClick={onBack}>Back</button>
      {blocker?.state === 'blocked' && (
        <div role="dialog">
          <button onClick={blocker.reset}>Stay</button>
          <button onClick={blocker.proceed}>Leave</button>
        </div>
      )}
    </>
  ),
}));
vi.mock('./Snapshots', () => ({
  default: ({ onOpen }: { onOpen: (id: string) => void }) => (
    <button onClick={() => onOpen('snapshot')}>Open snapshot</button>
  ),
}));
afterEach(cleanup);

function createController(dirty = false) {
  const graph = observable({ shouldBlockRouter: dirty });
  const controller = {
    graphWorkspace: { graph },
    schemaStore: {},
    getCurrentSchema: vi.fn().mockResolvedValue(undefined),
    getGraphItems: vi.fn().mockResolvedValue(undefined),
    loadSettings: vi.fn().mockResolvedValue(undefined),
  } as unknown as ExplorerStore;
  return { graph, controller };
}

it('reports actual dirty changes without clearing dirty state when the callback changes', async () => {
  const { graph, controller } = createController(true);
  const first = vi.fn();
  const second = vi.fn();
  const host = (callback: (dirty: boolean) => void) => (
    <UiProvider>
      <ExplorerWorkbench controller={controller} services={{} as never} onDirtyChange={callback} />
    </UiProvider>
  );
  const view = render(host(first));
  await waitFor(() => expect(first).toHaveBeenCalledWith(true));
  view.rerender(host(second));
  expect(first).not.toHaveBeenCalledWith(false);
  expect(second).not.toHaveBeenCalled();
  act(() =>
    runInAction(() => {
      graph.shouldBlockRouter = false;
    })
  );
  expect(second).toHaveBeenLastCalledWith(false);
  expect(second).toHaveBeenCalledOnce();
  act(() =>
    runInAction(() => {
      graph.shouldBlockRouter = true;
    })
  );
  view.unmount();
  expect(second).toHaveBeenLastCalledWith(false);
});

it.each([
  { name: 'internal navigation', controlled: false, external: false },
  { name: 'internal navigation with a host blocker', controlled: false, external: true },
  { name: 'controlled navigation without a host blocker', controlled: true, external: false },
])('confirms dirty $name before notifying the host', async ({ controlled, external }) => {
  const { graph, controller } = createController();
  const onSnapshotChange = vi.fn();
  const blocker = { state: 'unblocked', proceed: vi.fn(), reset: vi.fn() };
  render(
    <UiProvider>
      <ExplorerWorkbench
        controller={controller}
        services={{} as never}
        snapshotId={controlled ? 'snapshot' : undefined}
        onSnapshotChange={onSnapshotChange}
        blocker={external ? blocker : undefined}
      />
    </UiProvider>
  );
  if (!controlled) fireEvent.click(await screen.findByRole('button', { name: 'Open snapshot' }));
  await screen.findByRole('button', { name: 'Back' });
  onSnapshotChange.mockClear();
  act(() =>
    runInAction(() => {
      graph.shouldBlockRouter = true;
    })
  );

  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(onSnapshotChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  expect(onSnapshotChange).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
  expect(onSnapshotChange).toHaveBeenCalledOnce();
  expect(onSnapshotChange).toHaveBeenCalledWith(null);
  expect(screen.queryByRole('dialog')).toBeNull();
  if (!controlled) expect(screen.getByRole('button', { name: 'Open snapshot' })).toBeTruthy();
  expect(blocker.proceed).not.toHaveBeenCalled();
  expect(blocker.reset).not.toHaveBeenCalled();
});

it('delegates controlled navigation to the host blocker without adding a local confirmation', async () => {
  const { controller } = createController(true);
  const onSnapshotChange = vi.fn();
  const blocker = { state: 'unblocked', proceed: vi.fn(), reset: vi.fn() };
  const host = (state: string) => (
    <UiProvider>
      <ExplorerWorkbench
        controller={controller}
        services={{} as never}
        snapshotId="snapshot"
        onSnapshotChange={onSnapshotChange}
        blocker={{ ...blocker, state }}
      />
    </UiProvider>
  );
  const view = render(host('unblocked'));
  fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
  expect(onSnapshotChange).toHaveBeenCalledOnce();
  expect(onSnapshotChange).toHaveBeenCalledWith(null);
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(host('blocked'));
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(blocker.reset).toHaveBeenCalledOnce();
  view.rerender(host('unblocked'));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  view.rerender(host('blocked'));
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
  expect(blocker.proceed).toHaveBeenCalledOnce();
  expect(onSnapshotChange).toHaveBeenCalledTimes(2);
});

it('uses the host blocker for external navigation while a snapshot is internally selected', async () => {
  const { graph, controller } = createController();
  const blocker = { state: 'unblocked', proceed: vi.fn(), reset: vi.fn() };
  const host = (state: string) => (
    <UiProvider>
      <ExplorerWorkbench controller={controller} services={{} as never} blocker={{ ...blocker, state }} />
    </UiProvider>
  );
  const view = render(host('unblocked'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open snapshot' }));
  await screen.findByRole('button', { name: 'Back' });
  act(() =>
    runInAction(() => {
      graph.shouldBlockRouter = true;
    })
  );
  view.rerender(host('blocked'));
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
  expect(blocker.proceed).toHaveBeenCalledOnce();
});
