import { describe, expect, it } from 'vitest';
import type { NodeLayoutMap } from '@studio/interfaces';
import { resolveLayoutWrite, resolveNodeLayout, retainDraftNodePositions } from './layout';

const node = (id: string, name: string, x = 0, y = 0) => ({ id, name, position: { x, y } });

const NO_WRITE_YET = '';

describe('retainDraftNodePositions', () => {
  it('keeps only committed missing nodes and the current canvas positions', () => {
    expect(
      retainDraftNodePositions(
        { A: { x: 10, y: 20 }, C: { x: 30, y: 40 } },
        { A: { x: 0, y: 0 }, B: { x: 700, y: 900 }, Stale: { x: 1, y: 2 } },
        ['A', 'B']
      )
    ).toEqual({ A: { x: 10, y: 20 }, B: { x: 700, y: 900 }, C: { x: 30, y: 40 } });
  });

  it('does not resurrect deleted names after their schema changes are committed', () => {
    expect(
      retainDraftNodePositions({ A: { x: 10, y: 20 } }, { A: { x: 0, y: 0 }, B: { x: 700, y: 900 } }, ['A'])
    ).toEqual({ A: { x: 10, y: 20 } });
  });
});

describe('resolveNodeLayout', () => {
  it('leaves every node pending when nothing is saved and the canvas is empty', () => {
    const { positions, pinned, pending } = resolveNodeLayout(
      [node('a', 'A', 1, 2), node('b', 'B', 3, 4)],
      new Map(),
      null
    );

    expect([...pinned]).toEqual([]);
    expect([...pending].sort()).toEqual(['a', 'b']);
    expect(positions.get('a')).toEqual({ x: 1, y: 2 });
    expect(positions.get('b')).toEqual({ x: 3, y: 4 });
  });

  it('returns nothing for an empty schema', () => {
    const { positions, pinned, pending } = resolveNodeLayout([], new Map(), { A: { x: 1, y: 1 } });

    expect(positions.size).toBe(0);
    expect(pinned.size).toBe(0);
    expect(pending.size).toBe(0);
  });

  it('pins every node when the saved layout covers the whole schema', () => {
    const saved: NodeLayoutMap = { A: { x: 10, y: 20 }, B: { x: -5, y: 0 } };
    const { positions, pinned, pending } = resolveNodeLayout([node('a', 'A'), node('b', 'B')], new Map(), saved);

    expect([...pinned].sort()).toEqual(['a', 'b']);
    expect(pending.size).toBe(0);
    expect(positions.get('a')).toEqual({ x: 10, y: 20 });
    expect(positions.get('b')).toEqual({ x: -5, y: 0 });
  });

  it('only asks for a position for the node types missing from the saved layout', () => {
    const saved: NodeLayoutMap = { A: { x: 10, y: 20 } };
    const { positions, pinned, pending } = resolveNodeLayout(
      [node('a', 'A', 7, 7), node('c', 'C', 1, 1)],
      new Map(),
      saved
    );

    expect([...pinned]).toEqual(['a']);
    expect([...pending]).toEqual(['c']);
    expect(positions.get('a')).toEqual({ x: 10, y: 20 });
    expect(positions.get('c')).toEqual({ x: 1, y: 1 });
  });

  it('prefers the position already on the canvas over the saved one', () => {
    const current = new Map([['a', { x: 99, y: 98 }]]);
    const { positions, pinned, pending } = resolveNodeLayout([node('a', 'A', 1, 1)], current, { A: { x: 10, y: 20 } });

    expect(positions.get('a')).toEqual({ x: 99, y: 98 });
    expect([...pinned]).toEqual(['a']);
    expect(pending.size).toBe(0);
  });

  it('ignores saved entries for node types that no longer exist', () => {
    const { positions, pending } = resolveNodeLayout([node('a', 'A', 1, 2)], new Map(), { Gone: { x: 5, y: 5 } });

    expect(positions.get('a')).toEqual({ x: 1, y: 2 });
    expect([...pending]).toEqual(['a']);
  });

  it('treats a renamed node type as a new node', () => {
    const { pinned, pending } = resolveNodeLayout([node('a2', 'A_renamed', 1, 1)], new Map(), { A: { x: 10, y: 20 } });

    expect(pinned.size).toBe(0);
    expect([...pending]).toEqual(['a2']);
  });

  it('falls back to the style position when the saved coordinates are not finite', () => {
    const saved = { A: { x: Number.NaN, y: 2 }, B: { x: 1, y: Number.POSITIVE_INFINITY } } as unknown as NodeLayoutMap;
    const { positions, pinned, pending } = resolveNodeLayout(
      [node('a', 'A', 1, 2), node('b', 'B', 3, 4)],
      new Map(),
      saved
    );

    expect(pinned.size).toBe(0);
    expect([...pending].sort()).toEqual(['a', 'b']);
    expect(positions.get('a')).toEqual({ x: 1, y: 2 });
    expect(positions.get('b')).toEqual({ x: 3, y: 4 });
  });
});

describe('resolveLayoutWrite', () => {
  const layout: NodeLayoutMap = { A: { x: 1, y: 2 } };

  it('writes an arrangement that differs from the server state', () => {
    expect(resolveLayoutWrite(layout, { serverSignature: NO_WRITE_YET, writtenSignature: NO_WRITE_YET })).toEqual(
      layout
    );
  });

  it('skips an empty canvas, so a store reset is never persisted', () => {
    expect(resolveLayoutWrite({}, { serverSignature: NO_WRITE_YET, writtenSignature: NO_WRITE_YET })).toBeNull();
  });

  it('skips an arrangement the server already holds', () => {
    expect(
      resolveLayoutWrite(layout, {
        serverSignature: JSON.stringify(layout),
        writtenSignature: NO_WRITE_YET,
      })
    ).toBeNull();
  });

  it('skips an arrangement that was already written', () => {
    expect(
      resolveLayoutWrite(layout, {
        serverSignature: NO_WRITE_YET,
        writtenSignature: JSON.stringify(layout),
      })
    ).toBeNull();
  });

  it('writes the initial arrangement again after a different one was written', () => {
    expect(
      resolveLayoutWrite(layout, {
        serverSignature: JSON.stringify(layout),
        writtenSignature: JSON.stringify({ A: { x: 100, y: 200 } }),
      })
    ).toEqual(layout);
  });
});
