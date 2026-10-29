// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addCanvasShortcut } from './shortcut';
import type { GraphWorkspaceStore } from '../../stores/workspace';

const disposers: (() => void)[] = [];
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  document.body.replaceChildren();
});

function canvas(shortcuts?: Parameters<typeof addCanvasShortcut>[1]) {
  const container = document.createElement('div');
  container.tabIndex = 0;
  document.body.append(container);
  const graph = {
    graphContainer: container,
    nodes: new Set([{ id: '1' }]),
    nodesSelected: new Set([{ id: '1' }]),
    vertexFilterStore: { entityIdsGreyScaledSet: new Set() },
    undo: vi.fn(),
    redo: vi.fn(),
    deleteNodesAndEdges: vi.fn(),
    queryRelation: vi.fn(),
    replaceNodeSelected: vi.fn(),
    twoGraph: { zoom: vi.fn(), onZoomMouseUp: vi.fn() },
    explorerStore: { graphEdit: { editMode: false, openDeleteConfirm: vi.fn() } },
  };
  const workspace = { graph } as unknown as GraphWorkspaceStore;
  const dispose = addCanvasShortcut(workspace, shortcuts);
  disposers.push(dispose);
  return { graph, container, dispose };
}

function press(target: Element, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
}

describe('canvas shortcuts', () => {
  it('handles shortcuts only in the focused canvas and leaves outside controls alone', () => {
    const first = canvas();
    const second = canvas();
    first.container.focus();
    expect(press(first.container, 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(first.graph.undo).toHaveBeenCalledOnce();
    expect(second.graph.undo).not.toHaveBeenCalled();
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    expect(press(button, 'z', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(first.graph.undo).toHaveBeenCalledOnce();
    expect(second.graph.undo).not.toHaveBeenCalled();
  });

  it.each(['input', 'textarea', 'select', 'button', 'a', 'contenteditable'])(
    'does not intercept %s controls inside a canvas',
    (tag) => {
      const { graph, container } = canvas();
      const control = document.createElement(tag === 'contenteditable' ? 'div' : tag);
      if (tag === 'contenteditable') control.setAttribute('contenteditable', 'true');
      if (tag === 'a') control.setAttribute('href', '#');
      const target = tag === 'contenteditable' ? control.appendChild(document.createElement('span')) : control;
      container.append(control);
      expect(press(target, 'Backspace').defaultPrevented).toBe(false);
      expect(press(target, 'z', { metaKey: true }).defaultPrevented).toBe(false);
      expect(graph.deleteNodesAndEdges).not.toHaveBeenCalled();
      expect(graph.undo).not.toHaveBeenCalled();
    }
  );

  it('honors disabled actions while retaining selection and zoom shortcuts', () => {
    const { graph, container } = canvas({ undo: false, redo: false, delete: false, enter: false });
    press(container, 'Backspace');
    press(container, 'Enter');
    press(container, 'z', { ctrlKey: true });
    press(container, 'Z', { ctrlKey: true, shiftKey: true });
    expect(graph.deleteNodesAndEdges).not.toHaveBeenCalled();
    expect(graph.queryRelation).not.toHaveBeenCalled();
    expect(graph.undo).not.toHaveBeenCalled();
    expect(graph.redo).not.toHaveBeenCalled();
    press(container, 'a', { metaKey: true });
    expect(graph.replaceNodeSelected).toHaveBeenCalledWith([{ id: '1' }]);
    press(container, '+');
    expect(graph.twoGraph.zoom).toHaveBeenCalledWith('in');
  });

  it('retains enabled redo, delete, expansion and edit-mode confirmation', () => {
    const { graph, container } = canvas();
    press(container, 'Z', { metaKey: true, shiftKey: true });
    press(container, 'Backspace', { shiftKey: true });
    press(container, 'Enter');
    expect(graph.redo).toHaveBeenCalledOnce();
    expect(graph.deleteNodesAndEdges).toHaveBeenCalledWith({ reverse: true });
    expect(graph.queryRelation).toHaveBeenCalledOnce();
    graph.explorerStore.graphEdit.editMode = true;
    press(container, 'Backspace');
    press(container, 'Enter');
    expect(graph.explorerStore.graphEdit.openDeleteConfirm).toHaveBeenCalledOnce();
    expect(graph.queryRelation).toHaveBeenCalledOnce();
  });

  it('allows Tab navigation and ignores composing or already-handled events', () => {
    const { graph, container } = canvas();
    expect(press(container, 'Tab').defaultPrevented).toBe(false);
    press(container, 'Backspace', { isComposing: true });
    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    event.preventDefault();
    container.dispatchEvent(event);
    expect(graph.deleteNodesAndEdges).not.toHaveBeenCalled();
  });

  it('stops keyboard zoom on key release, focus loss, window blur and disposal', () => {
    const { graph, container, dispose } = canvas();
    container.focus();
    press(container, '+');
    graph.twoGraph.onZoomMouseUp.mockClear();
    container.dispatchEvent(new KeyboardEvent('keyup', { key: '=', bubbles: true }));
    expect(graph.twoGraph.onZoomMouseUp).toHaveBeenCalledOnce();
    press(container, '_');
    graph.twoGraph.onZoomMouseUp.mockClear();
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    expect(graph.twoGraph.onZoomMouseUp).toHaveBeenCalledOnce();
    press(container, '+');
    graph.twoGraph.onZoomMouseUp.mockClear();
    window.dispatchEvent(new Event('blur'));
    expect(graph.twoGraph.onZoomMouseUp).toHaveBeenCalledOnce();
    press(container, '+');
    graph.twoGraph.onZoomMouseUp.mockClear();
    dispose();
    expect(graph.twoGraph.onZoomMouseUp).toHaveBeenCalledOnce();
    press(container, 'Backspace');
    expect(graph.deleteNodesAndEdges).not.toHaveBeenCalled();
  });
});
