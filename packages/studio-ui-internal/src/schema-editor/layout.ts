import type { NodeLayoutMap } from '../schema/types';

export const serializeNodePositions = (entries: { name?: string; x: number; y: number }[]): NodeLayoutMap => {
  const layout: NodeLayoutMap = {};
  let count = 0;
  for (const { name, x, y } of entries) {
    if (!name || !Number.isFinite(x) || !Number.isFinite(y) || count >= 20000) continue;
    Object.defineProperty(layout, name, { value: { x, y }, enumerable: true, configurable: true, writable: true });
    count += 1;
  }
  return layout;
};
