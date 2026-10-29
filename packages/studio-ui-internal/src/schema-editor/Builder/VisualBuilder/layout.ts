import type { NodeLayoutMap, NodePosition } from '../../../schema/types';

/**
 * Decides, for every node type currently in the schema, where it should sit on the
 * visual builder canvas.
 *
 * Priority per node:
 *  1. the position it already has on this session's canvas,
 *  2. the position saved for its node type **name** (survives DDL edits, since the
 *     generated item ids are recreated on every schema rebuild),
 *  3. its `style.position` fallback (`#getInitNodePosition` or a drop point).
 *
 * Both (1) and (2) are "pinned": an automatic layout must not move them. (3) is
 * "pending" and gets placed by the force layout, anchored by the pinned nodes.
 */

export interface LayoutResolveInput {
  id: string;
  name: string;
  position: NodePosition;
}

export interface ResolvedNodeLayout {
  /** Final position for every input node. */
  positions: Map<string, NodePosition>;
  /** Nodes whose position must be preserved exactly. */
  pinned: Set<string>;
  /** Nodes that still need an automatic position. */
  pending: Set<string>;
}

const isPosition = (value: NodePosition | undefined): value is NodePosition =>
  Boolean(value) && Number.isFinite(value!.x) && Number.isFinite(value!.y);

export const resolveNodeLayout = (
  incoming: LayoutResolveInput[],
  current: Map<string, NodePosition>,
  saved: NodeLayoutMap | null
): ResolvedNodeLayout => {
  const positions = new Map<string, NodePosition>();
  const pinned = new Set<string>();
  const pending = new Set<string>();

  incoming.forEach(({ id, name, position }) => {
    const onCanvas = current.get(id);
    if (isPosition(onCanvas)) {
      positions.set(id, { x: onCanvas.x, y: onCanvas.y });
      pinned.add(id);
      return;
    }

    const stored = saved?.[name];
    if (isPosition(stored)) {
      positions.set(id, { x: stored.x, y: stored.y });
      pinned.add(id);
      return;
    }

    positions.set(id, { x: position.x, y: position.y });
    pending.add(id);
  });

  return { positions, pinned, pending };
};

/** Draft deletions and renames must not discard positions of committed node types. */
export const retainDraftNodePositions = (
  canvas: NodeLayoutMap,
  remembered: NodeLayoutMap,
  committedNames: Iterable<string>
): NodeLayoutMap => ({
  ...Object.fromEntries(
    [...committedNames].filter((name) => isPosition(remembered[name])).map((name) => [name, remembered[name]])
  ),
  ...canvas,
});

/**
 * Whether a canvas arrangement needs to be written.
 *
 * Returns `null` when there is nothing to persist: an empty canvas (the store is
 * cleared on unmount, and React may mount twice in development) or an arrangement
 * that already matches what the server holds or what we last wrote.
 */
export const resolveLayoutWrite = (
  layout: NodeLayoutMap,
  { serverSignature, writtenSignature }: { serverSignature: string; writtenSignature: string }
): NodeLayoutMap | null => {
  if (Object.keys(layout).length === 0) {
    return null;
  }
  const signature = JSON.stringify(layout);
  if (signature === (writtenSignature || serverSignature)) {
    return null;
  }
  return layout;
};
