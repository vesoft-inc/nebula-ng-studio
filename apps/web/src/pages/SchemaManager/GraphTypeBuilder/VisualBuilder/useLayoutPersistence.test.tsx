// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { runInAction } from 'mobx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INodeTypeItem, type NodeLayoutMap } from '@studio/interfaces';
import type { SchemaLayoutIdentity } from '@studio/services/schemaLayout';

const writer = vi.hoisted(() => ({
  writeGraphTypeLayout: vi.fn(async (_identity: SchemaLayoutIdentity, _layout: NodeLayoutMap) => true),
}));
vi.mock('@studio/services', () => writer);
vi.mock('./store', async () => {
  const { observable } = await import('mobx');
  const nodes = observable.array<{
    id: string;
    position: { x: number; y: number };
    data: { nodeTypeItem: { name: string } };
  }>([], { deep: false });
  return {
    reactFlowNodes: nodes,
    getCanvasLayout: () => Object.fromEntries(nodes.map((node) => [node.data.nodeTypeItem.name, node.position])),
  };
});

import { reactFlowNodes, type ReactFlowNode } from './store';
import { useLayoutPersistence } from './useLayoutPersistence';

const identity = {
  address: '127.0.0.1:9669',
  username: 'root',
  schemaPath: '/schema/demo',
  graphTypeName: 'movie_type',
};
const node = (name: string, x: number, y: number): ReactFlowNode => ({
  id: name,
  position: { x, y },
  data: { nodeTypeItem: new INodeTypeItem({ name }), isActive: false, isReadonly: false },
});

function Harness({
  initialLayout,
  graphTypeName = identity.graphTypeName,
}: {
  initialLayout: NodeLayoutMap;
  graphTypeName?: string;
}) {
  useLayoutPersistence({ enabled: true, ...identity, graphTypeName, initialLayout, preserveNodeNames: ['A', 'B'] });
  return null;
}

describe('useLayoutPersistence', () => {
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    writer.writeGraphTypeLayout.mockReset().mockResolvedValue(true);
    runInAction(() => reactFlowNodes.clear());
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const mount = async (layout: NodeLayoutMap) => {
    runInAction(() => reactFlowNodes.replace(Object.entries(layout).map(([name, { x, y }]) => node(name, x, y))));
    await act(async () => root.render(<Harness initialLayout={layout} />));
  };

  const change = async (nodes: ReactFlowNode[], debounce = true) => {
    await act(async () => {
      runInAction(() => reactFlowNodes.replace(nodes));
      if (debounce) await vi.advanceTimersByTimeAsync(800);
    });
  };

  it('persists A -> B -> A rather than treating the initial coordinates as already saved', async () => {
    await mount({ A: { x: 0, y: 0 } });
    await change([node('A', 100, 200)]);
    await change([node('A', 0, 0)]);

    expect(writer.writeGraphTypeLayout).toHaveBeenCalledTimes(2);
    expect(writer.writeGraphTypeLayout).toHaveBeenLastCalledWith(identity, { A: { x: 0, y: 0 } });
  });

  it('queues the restored coordinates behind an in-flight save', async () => {
    await mount({ A: { x: 0, y: 0 } });
    let completeSave!: (saved: boolean) => void;
    let completeLastSave!: (saved: boolean) => void;
    writer.writeGraphTypeLayout.mockReturnValueOnce(new Promise((resolve) => (completeSave = resolve)));
    writer.writeGraphTypeLayout.mockReturnValueOnce(new Promise((resolve) => (completeLastSave = resolve)));
    await change([node('A', 100, 200)]);
    await change([node('A', 0, 0)]);

    expect(writer.writeGraphTypeLayout).toHaveBeenCalledTimes(2);
    expect(writer.writeGraphTypeLayout).toHaveBeenLastCalledWith(identity, { A: { x: 0, y: 0 } });
    await act(async () => completeSave(true));
    await act(async () => completeLastSave(true));
    await act(async () => root.unmount());
    expect(writer.writeGraphTypeLayout).toHaveBeenCalledTimes(2);
  });

  it('does not write a fully restored canvas or an empty store reset', async () => {
    await mount({ A: { x: 0, y: 0 } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    await change([]);

    expect(writer.writeGraphTypeLayout).not.toHaveBeenCalled();
  });

  it('captures and persists an initial automatic layout without needing a drag', async () => {
    runInAction(() => reactFlowNodes.replace([node('A', 100, 200)]));
    await act(async () => root.render(<Harness initialLayout={{}} />));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(writer.writeGraphTypeLayout).toHaveBeenLastCalledWith(identity, { A: { x: 100, y: 200 } });
  });

  it('does not duplicate a save when StrictMode replays effect setup and cleanup', async () => {
    runInAction(() => reactFlowNodes.replace([node('A', 100, 200)]));
    await act(async () =>
      root.render(
        <StrictMode>
          <Harness initialLayout={{}} />
        </StrictMode>
      )
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(writer.writeGraphTypeLayout).toHaveBeenCalledTimes(1);
  });

  it('retains deleted draft nodes at their latest position when leaving before the debounce fires', async () => {
    await mount({ A: { x: 0, y: 0 }, B: { x: 700, y: 900 } });
    await change([node('A', 0, 0), node('B', 800, 1000)], false);
    await change([node('A', 10, 20)], false);
    await act(async () => root.unmount());

    expect(writer.writeGraphTypeLayout).toHaveBeenLastCalledWith(identity, {
      A: { x: 10, y: 20 },
      B: { x: 800, y: 1000 },
    });
  });

  it('retains the original name when a draft node is renamed', async () => {
    await mount({ A: { x: 0, y: 0 }, B: { x: 700, y: 900 } });
    await change([node('A', 0, 0), node('B_renamed', 700, 900)]);

    expect(writer.writeGraphTypeLayout).toHaveBeenLastCalledWith(identity, {
      A: { x: 0, y: 0 },
      B: { x: 700, y: 900 },
      B_renamed: { x: 700, y: 900 },
    });
  });

  it('flushes again on unmount after an unsuccessful save', async () => {
    await mount({ A: { x: 0, y: 0 } });
    writer.writeGraphTypeLayout.mockResolvedValueOnce(false);
    await change([node('A', 100, 200)]);
    await act(async () => root.unmount());

    expect(writer.writeGraphTypeLayout).toHaveBeenCalledTimes(2);
    expect(writer.writeGraphTypeLayout).toHaveBeenLastCalledWith(identity, { A: { x: 100, y: 200 } });
  });

  it('does not deduplicate a new graph type against a previous graph type', async () => {
    await mount({ A: { x: 0, y: 0 } });
    await change([node('A', 100, 200)]);
    await act(async () => root.render(<Harness initialLayout={{}} graphTypeName="other_type" />));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(writer.writeGraphTypeLayout).toHaveBeenLastCalledWith(
      { ...identity, graphTypeName: 'other_type' },
      { A: { x: 100, y: 200 } }
    );
  });
});
