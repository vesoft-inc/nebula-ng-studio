// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleResult } from '../../types';
import type { GraphDataTable } from '../../../graph/types/console';
import GraphResult from './index';

const state = vi.hoisted(() => ({ host: {} as any, workspaces: [] as any[] }));
vi.mock('../resultHost', () => ({ useConsoleResultHost: () => state.host }));
vi.mock('../../../graph/stores/workspace', () => ({
  GraphWorkspaceStore: class {
    graph = { nodesSelected: [], linksSelected: [], loading: false };
    destroy = vi.fn();
    initGraphTypeDetails = vi.fn();
    constructor() {
      state.workspaces.push(this);
    }
  },
}));
vi.mock('../../../graph/components/Content/index', () => ({ CommonGraphContent: () => <div /> }));
vi.mock('../../../graph/components/Minimap/index', () => ({
  default: () => null,
  MinimapActionButtonGraphLayout: () => null,
  MinimapActionButtonZoomIn: () => null,
  MinimapActionButtonZoomOut: () => null,
}));
vi.mock('../../../graph/components/RightSideTool/index', () => ({ RightSideToolDrawer: () => null }));
vi.mock('../../../graph/components/PageLoading/index', () => ({ default: () => null }));
vi.mock('./JsonPreview', () => ({ default: () => null }));

function setupHost() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  const cache = new Map();
  state.host = {
    prepareGraphTypes: () => promise,
    graphTypesFor: () => [],
    getWorkspace: (id: string) => cache.get(id),
    saveWorkspace: (id: string, workspace: any) => cache.set(id, workspace),
    deleteWorkspace: (id: string) => cache.delete(id),
    modalStore: { message: { error: vi.fn() } },
  };
  return { resolve, cache };
}
const result = { id: 'result-1', data: { tables: [] } } as unknown as ConsoleResult<GraphDataTable>;
afterEach(() => {
  cleanup();
  state.workspaces.length = 0;
});

describe('GraphResult lifetime', () => {
  it('does not create or cache a workspace when removed during metadata loading', async () => {
    const { resolve, cache } = setupHost();
    const view = render(
      <StrictMode>
        <GraphResult result={result} />
      </StrictMode>
    );
    view.unmount();
    await act(async () => resolve());
    expect(state.workspaces).toHaveLength(0);
    expect(cache.size).toBe(0);
  });

  it('disposes the rendered workspace and removes its cache entry on unmount', async () => {
    const { resolve, cache } = setupHost();
    const view = render(
      <StrictMode>
        <GraphResult result={result} />
      </StrictMode>
    );
    await act(async () => resolve());
    expect(state.workspaces).toHaveLength(1);
    expect(cache.get(result.id)).toBe(state.workspaces[0]);
    view.unmount();
    expect(state.workspaces[0].destroy).toHaveBeenCalledOnce();
    expect(cache.size).toBe(0);
  });
});
