// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ForceGraph from './index.js';

const createCanvasContext = () =>
  new Proxy(
    {
      canvas: document.createElement('canvas'),
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) }),
      measureText: () => ({ width: 0 }),
    },
    {
      get(target, property) {
        if (!(property in target)) {
          target[property] = vi.fn();
        }
        return target[property];
      },
      set(target, property, value) {
        target[property] = value;
        return true;
      },
    }
  );

describe('ForceGraph lifecycle', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => createCanvasContext());
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1)
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('mounts, updates data and callbacks, then destroys safely', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const graph = ForceGraph()(root);
    const data = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      links: [{ source: 'a', target: 'b' }],
    };
    const onNodeClick = vi.fn();

    expect(root.querySelector('.force-graph-container canvas')).toBeInstanceOf(HTMLCanvasElement);
    expect(graph.graphData(data)).toBe(graph);
    expect(graph.graphData()).toBe(data);

    expect(graph.onNodeClick(onNodeClick)).toBe(graph);
    expect(graph.onNodeClick()).toBe(onNodeClick);
    expect(graph.onNodeClick(null)).toBe(graph);
    expect(graph.onNodeClick()).toBeNull();

    expect(() => graph._destructor()).not.toThrow();
    expect(graph.graphData()).toEqual({ nodes: [], links: [] });
  });
});
