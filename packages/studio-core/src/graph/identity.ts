/** Graph data contracts and identity helpers, without UI or session dependencies. */

type EdgeIdentityPart = string | number | bigint | { toString(): string };

export interface GraphEdgeIdentity {
  srcId: EdgeIdentityPart;
  dstId: EdgeIdentityPart;
  rank: EdgeIdentityPart;
  type: string;
  graph: string;
  isDirected: boolean;
}

/** Preserve graph, type, rank and direction while canonicalizing undirected endpoints. */
export function getGraphEdgeId(edge: GraphEdgeIdentity): string {
  const srcId = String(edge.srcId);
  const dstId = String(edge.dstId);
  const [sourceId, targetId] = edge.isDirected ? [srcId, dstId] : [srcId, dstId].sort();
  return JSON.stringify([
    'EDGE',
    edge.graph,
    edge.type,
    edge.isDirected ? 'DIRECTED' : 'UNDIRECTED',
    sourceId,
    targetId,
    String(edge.rank),
  ]);
}
