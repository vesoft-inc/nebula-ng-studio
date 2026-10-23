import type { DescEdgeTypeResult, DescNodeTypeResult } from '../types';
import { useEffect, useState } from 'react';
import { GraphEntityType, type GQLResult } from '@vesoft-inc/utils';
import { useIndexQuery, type RunGql } from './queryContext';

const getTypesForNodesAndEdges = async (graphTypeName: string, runGql: RunGql) => {
  const gqls = [
    [
      `{LET gtn = "${graphTypeName}"`,
      `CALL describe_graph_type(gtn) YIELD entity_type, type_name filter where entity_type = "Node"`,
      `CALL describe_node_type(gtn, type_name)`,
      `RETURN *}`,
    ].join(' '),
    [
      `{LET gtn = "${graphTypeName}"`,
      `CALL describe_graph_type(gtn) YIELD entity_type, type_name filter where entity_type = "Edge"`,
      `CALL describe_edge_type(gtn, type_name)`,
      `RETURN *}`,
    ].join(' '),
  ];
  const items = (
    await Promise.all(
      gqls.map((gql, index) =>
        runGql<GQLResult<DescNodeTypeResult | DescEdgeTypeResult>>(gql).then((r) =>
          (r.data?.tables || []).map((item) => ({
            ...item,
            type: index === 0 ? GraphEntityType.Node : GraphEntityType.Edge,
          }))
        )
      )
    )
  ).flat();
  return items;
};

export const useTypesForNodesAndEdges = ({
  graphTypeName,
  typeName,
  entityType,
  enabled = true,
}: {
  graphTypeName?: string;
  typeName?: string;
  entityType?: GraphEntityType;
  enabled?: boolean;
}) => {
  const runGql = useIndexQuery();
  const [result, setResult] = useState<{
    graphTypeName: string;
    items: (DescNodeTypeResult | DescEdgeTypeResult)[];
  }>();

  useEffect(() => {
    let active = true;
    setResult(undefined);
    if (graphTypeName && enabled) {
      void getTypesForNodesAndEdges(graphTypeName, runGql)
        .then((items) => {
          if (active) setResult({ graphTypeName, items });
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [graphTypeName, enabled, runGql]);

  return {
    items:
      enabled && result?.graphTypeName === graphTypeName
        ? result?.items.filter((item) => item.type_name === typeName && item.type === entityType) || []
        : [],
  };
};
