import { GraphDataTable } from './types/console';
import { NodeObject } from '@vesoft-inc/force-graph';
import { GQLResult } from '@vesoft-inc/utils';
export const LINE_LENGTH = 150;
export const FONT_SIZE = 10;
export const NODE_SIZE = 22;
export const NODE_AREA = NODE_SIZE * NODE_SIZE;

export const FORCEGRAPH_COLOR_PICK_LIST = [
  '#8ACCFF',
  '#78B8A3',
  '#F8CE60',
  '#F78888',
  '#9EACB4',
  '#27BDDE',
  '#BAD08E',
  '#F1A829',
  '#F2B3B3',
  '#D3E5EC',
  '#AAE6FF',
  '#B6D2CA',
  '#FFBE7F',
  '#D7798F',
  '#C4C8DB',
  '#9DC2DE',
  '#96D2CF',
  '#C98500',
  '#EFC8D1',
  '#C0B0B0',
  '#579AEC',
  '#678945',
  '#EAD091',
  '#CFA0BE',
  '#CBCBCB',
  '#7E9AE7',
  '#8EC38D',
  '#E7C700',
  '#EC7565',
  '#8C8C77',
];

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

export function drawTextWithEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
) {
  // Measure the width of the text
  let width = ctx.measureText(text).width;

  // If the text is within the maxWidth, draw it as is
  if (width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  // Add ellipsis to the text
  const ellipsis = '...';
  const ellipsisWidth = ctx.measureText(ellipsis).width;

  // Calculate the maximum width for the truncated text
  const maxTextWidth = maxWidth - ellipsisWidth;

  // Truncate the text
  let truncatedText = '';
  for (let i = 0; i < text.length; i++) {
    truncatedText += text[i];
    width = ctx.measureText(truncatedText).width;
    if (width > maxTextWidth) {
      truncatedText = truncatedText.slice(0, -1);
      break;
    }
  }
  ctx.fillText(truncatedText + ellipsis, x, y);
}

export function isGraphResult(data: GraphDataTable[]) {
  if (data.length === 0) {
    return false;
  }
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const values = Object.values(item);
    for (let j = 0; j < values.length; j++) {
      const rowItem = values[j];
      if (rowItem === null) continue;
      if (Array.isArray(rowItem)) {
        if (rowItem.some((item) => item && (item.type === 'NODE' || item.type === 'PATH'))) {
          return true;
        }
      } else {
        if (rowItem.type === 'NODE' || rowItem.type === 'PATH') {
          return true;
        }
      }
    }
  }
  return false;
}

export function hasExplainInfo(result: GQLResult) {
  return result.summary?.planInfo;
}

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
