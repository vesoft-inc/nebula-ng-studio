import { describe, expect, it } from 'vitest';
import { computeForceLayout } from './forceLayout';

const byId = (nodes: { id: string; x: number; y: number }[]) => new Map(nodes.map((node) => [node.id, node]));

describe('computeForceLayout', () => {
  it('returns nothing for an empty graph', () => {
    expect(computeForceLayout([], [])).toEqual([]);
  });

  it('returns a position for every input node', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 40, y: 40 },
      { id: 'c', x: -40, y: 40 },
    ];

    const result = computeForceLayout(nodes, [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
    ]);

    expect(result.map((node) => node.id).sort()).toEqual(['a', 'b', 'c']);
    result.forEach((node) => {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    });
  });

  it('keeps pinned nodes at their exact input coordinates', () => {
    const nodes = [
      { id: 'pinned', x: 12.5, y: -30.25 },
      { id: 'free', x: 12.5, y: -30.25 },
    ];

    const result = byId(computeForceLayout(nodes, [], { fixedIds: ['pinned'] }));

    expect(result.get('pinned')).toEqual({ id: 'pinned', x: 12.5, y: -30.25 });
  });

  it('pushes an unpinned node away from the pinned nodes that anchor it', () => {
    const nodes = [
      { id: 'pinned', x: 0, y: 0 },
      { id: 'free', x: 0, y: 0 },
    ];

    const result = byId(computeForceLayout(nodes, [], { fixedIds: new Set(['pinned']) }));
    const free = result.get('free')!;

    expect(Math.hypot(free.x, free.y)).toBeGreaterThan(70);
  });

  it('moves every node when no node is pinned', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ];

    const result = byId(computeForceLayout(nodes, []));

    expect(result.get('a')).not.toEqual({ id: 'a', x: 0, y: 0 });
    expect(result.get('b')).not.toEqual({ id: 'b', x: 0, y: 0 });
  });
});
