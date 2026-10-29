// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { UiProvider } from '../../../provider';
import type { GraphWorkspaceStore } from '../../stores/workspace';
import { CommonGraphContent } from './index';

vi.mock('../GraphTooltip/index', () => ({ initTooltip: vi.fn() }));
afterEach(cleanup);

it('focuses the canvas on pointer interaction and forwards all shortcut options', () => {
  const graph = {
    graphContainer: null as HTMLElement | null,
    showBackGrid: false,
    nodes: new Set(),
    nodesSelected: new Set([{ id: '1' }]),
    initGraph({ container }: { container: HTMLElement }) {
      this.graphContainer = container;
    },
    destroyGraph: vi.fn(),
    deleteNodesAndEdges: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    queryRelation: vi.fn(),
    explorerStore: { graphEdit: { editMode: false } },
  };
  const item = { explorerId: 'result', graph, setRuntime: vi.fn() } as unknown as GraphWorkspaceStore;
  render(
    <UiProvider>
      <CommonGraphContent
        explorerItem={item}
        onInitGraph={({ initGraph, addShortcuts, addCleanup }) => {
          initGraph();
          addCleanup(addShortcuts(item, { undo: false, redo: false, delete: false, enter: false }));
        }}
      />
    </UiProvider>
  );
  fireEvent.pointerDown(graph.graphContainer!);
  expect(document.activeElement).toBe(graph.graphContainer);
  fireEvent.keyDown(graph.graphContainer!, { key: 'Backspace' });
  fireEvent.keyDown(graph.graphContainer!, { key: 'Enter' });
  fireEvent.keyDown(graph.graphContainer!, { key: 'z', ctrlKey: true });
  fireEvent.keyDown(graph.graphContainer!, { key: 'Z', ctrlKey: true, shiftKey: true });
  expect(graph.deleteNodesAndEdges).not.toHaveBeenCalled();
  expect(graph.queryRelation).not.toHaveBeenCalled();
  expect(graph.undo).not.toHaveBeenCalled();
  expect(graph.redo).not.toHaveBeenCalled();
});
