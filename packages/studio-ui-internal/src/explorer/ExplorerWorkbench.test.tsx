// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { observable, runInAction } from 'mobx';
import { afterEach, expect, it, vi } from 'vitest';
import { ExplorerWorkbench } from './ExplorerWorkbench';
import type { ExplorerStore } from './ExplorerController';
import { UiProvider } from '../provider';

vi.mock('./Graph', () => ({ default: () => null }));
vi.mock('./Snapshots', () => ({ default: () => null }));
afterEach(cleanup);

it('reports actual dirty changes without clearing dirty state when the callback changes', async () => {
  const graph = observable({ shouldBlockRouter: true });
  const controller = {
    graphWorkspace: { graph },
    schemaStore: {},
    getCurrentSchema: vi.fn().mockResolvedValue(undefined),
    getGraphItems: vi.fn().mockResolvedValue(undefined),
    loadSettings: vi.fn().mockResolvedValue(undefined),
  } as unknown as ExplorerStore;
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
  expect(second).toHaveBeenCalledWith(true);
  act(() =>
    runInAction(() => {
      graph.shouldBlockRouter = false;
    })
  );
  expect(second).toHaveBeenLastCalledWith(false);
  act(() =>
    runInAction(() => {
      graph.shouldBlockRouter = true;
    })
  );
  view.unmount();
  expect(second).toHaveBeenLastCalledWith(false);
});
