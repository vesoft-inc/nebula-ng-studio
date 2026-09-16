import { EdgeValue, GraphEdgeValue, GraphNodeValue, PathValue, VertexValue } from '@studio/interfaces/explorer/gql';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { getGraphEdgeId } from '@vesoft-inc/utils';

export const parseVertexValueToNodeObject = (
  vertex: VertexValue | PathValue<GraphNodeValue>,
  color: string,
  nodeTypePrimaryKeysMap?: Map<string, string[]>
): NodeObject => {
  const { value } = vertex;
  return {
    id: value.id.toString(),
    data: vertex,
    color,
    label: nodeTypePrimaryKeysMap
      ?.get(value.type)
      ?.map((key) => value.properties[key])
      .join(' '),
  } as NodeObject;
};

export const parseEdgeValueToLinkObject = (data: EdgeValue | PathValue<GraphEdgeValue>, color: string): LinkObject => {
  const { value } = data;
  return {
    id: getGraphEdgeId(value),
    source: value.srcId.toString(),
    target: value.dstId.toString(),
    rank: value.rank,
    edgeType: value.type,
    properties: value.properties,
    data,
    color,
    label: value.type,
    isDirected: value.isDirected,
  } as LinkObject;
};

export function isEdgeNodeValue(value: GraphNodeValue | GraphEdgeValue): boolean {
  return 'srcId' in value && 'dstId' in value;
}
