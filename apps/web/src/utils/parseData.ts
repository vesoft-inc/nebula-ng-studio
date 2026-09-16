import { FORCEGRAPH_COLOR_PICK_LIST, flattenGraphTableData } from '@studio/utils/explorer';
import {
  GraphDataTable,
  GraphDataTableValueType,
  GraphEdgeValue,
  GraphNodeValue,
  RawEntityType,
} from '@studio/interfaces/console';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { parseEdgeValueToLinkObject, parseVertexValueToNodeObject } from '.';

export const whichColor = () => {
  const colorsTotal = FORCEGRAPH_COLOR_PICK_LIST.length;
  let colorIndex = 0;
  const colorsRecord = new Map<string, string>();
  return (key: string) => {
    if (!colorsRecord.has(key)) {
      colorsRecord.set(key, FORCEGRAPH_COLOR_PICK_LIST[colorIndex]);
      colorIndex = (colorIndex + 1) % colorsTotal;
    }
    return colorsRecord.get(key)!;
  };
};

function isEdgeNodeValue(value: GraphNodeValue | GraphEdgeValue): boolean {
  return 'srcId' in value && 'dstId' in value;
}

export function parseSubGraph(data: GraphDataTable[]): {
  vertexes: NodeObject[];
  edges: LinkObject[];
} {
  const vertexes: NodeObject[] = [];
  const edges: LinkObject[] = [];
  const colorPicker = whichColor();
  data.forEach((row) => {
    const values = Object.keys(row)
      .filter((key) => row[key] !== null && typeof row[key] === 'object')
      .map((key) => row[key]!);
    flattenGraphTableData<GraphDataTableValueType>(values).forEach((rowItem) => {
      if (!rowItem) return;
      if (rowItem.type === RawEntityType.EDGE) {
        edges.push(parseEdgeValueToLinkObject(rowItem));
      } else if (rowItem.type === RawEntityType.NODE) {
        const key = `${rowItem.type}-${rowItem.value.type}`;
        vertexes.push(parseVertexValueToNodeObject(rowItem, colorPicker(key)));
      } else if (rowItem.type === RawEntityType.PATH) {
        rowItem.value.forEach((item) => {
          if (isEdgeNodeValue(item)) {
            edges.push(
              parseEdgeValueToLinkObject({
                raw: `${(item as GraphEdgeValue).srcId}-${(item as GraphEdgeValue).dstId}-${(item as GraphEdgeValue).rank}`,
                type: RawEntityType.EDGE,
                value: item as GraphEdgeValue,
              })
            );
          } else {
            const key = `${rowItem.type}-${item.type}`;
            vertexes.push(
              parseVertexValueToNodeObject(
                {
                  raw: rowItem.raw,
                  type: RawEntityType.NODE,
                  value: item as GraphNodeValue,
                },
                colorPicker(key)
              )
            );
          }
        });
      }
    });
  });
  return { vertexes, edges };
}

export function getUsedGraphsFromData(data: GraphDataTable[]): string[] {
  const graphsSet = new Set<string>();
  data.forEach((row) => {
    const values = Object.keys(row)
      .filter((key) => row[key] !== null && typeof row[key] === 'object')
      .map((key) => row[key]!);
    flattenGraphTableData(values).forEach((rowItem) => {
      if (!rowItem) return;
      if (Array.isArray(rowItem.value)) {
        rowItem.value.forEach((item) => {
          graphsSet.add(item.graph);
        });
      } else if (rowItem.value) {
        graphsSet.add(rowItem.value.graph);
      }
    });
  });
  return Array.from(graphsSet);
}
