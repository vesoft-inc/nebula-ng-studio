import type { NodeObject } from '@vesoft-inc/force-graph';
import { EdgeDirectionType } from '@vesoft-inc/studio-core/contracts';

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 2.5;
export const LINE_LENGTH = 150;
export const FONT_SIZE = 10;
export const NODE_SIZE = 18;
export const NODE_AREA = NODE_SIZE * NODE_SIZE;
export const DEGREE_TIME = 2000;
export const CLUSTER_LINE_WIDTH = 10;
export const CLUSTER_LINE_COLOR = '#295165';
export const LABEL_VISIBLE_ZOOM = 0.5;

export const DEFAULT_COLOR_PICKER = '#5CDBD3';
export const EMPTY_ICON = 'REMOVE';
export const DEFAULT_RETURN_LIMIT = '100';

export const DEFAULT_EXPLORE_RULES = {
  edgeTypes: [] as string[],
  edgeDirection: EdgeDirectionType.Forward,
  stepsType: 'single',
  step: 1,
  vertexStyle: 'groupByTag',
};

export const makeRoundPosition = (data: NodeObject[] | Set<NodeObject>, center: { x: number; y: number }) => {
  const nodes = [...data];
  const length = nodes.length;
  const radius = Math.min(Math.max((length * NODE_SIZE) / 2, LINE_LENGTH), window.innerHeight / 2);
  // when nodes.length>50 use sphere layout
  if (nodes.length < 50) {
    nodes.forEach((node, index) => {
      const angle = (index / length) * Math.PI * 2;
      node.x = radius * Math.sin(angle) + center.x;
      node.y = radius * Math.cos(angle) + center.y;
    });
  } else {
    nodes.forEach((node) => {
      const angle = Math.random() * Math.PI * 2;
      const r = radius * Math.random();
      node.x = r * Math.sin(angle) + center.x;
      node.y = r * Math.cos(angle) + center.y;
    });
  }
};

export const CANVAS_HIDE_LABEL_SCALE = 1.0;

function isOneDimensionalArray<T>(arr: T[]) {
  if (!Array.isArray(arr)) {
    throw new Error('Input is not an array');
  }

  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      return false;
    }
  }
  return true;
}

export function flattenGraphTableData<T>(arr: (T[] | T)[]): T[] {
  if (arr === null) return [];
  if (isOneDimensionalArray<T>(arr as T[])) return arr as T[];
  return (arr as T[][]).reduce((acc, val) => acc.concat(val), []);
}
