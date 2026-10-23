import { DescEdgeTypeResult, DescNodeTypeResult } from '../types';
import { useEffect, useRef, useState } from 'react';
import { GraphTypeElementOption } from './FormNormalIndex';
import { GQLResult } from '@vesoft-inc/utils';
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
      gqls.map((gql) =>
        runGql<GQLResult<DescNodeTypeResult | DescEdgeTypeResult>>(gql).then((r) => r.data?.tables || [])
      )
    )
  ).flat();
  return items;
};

export const useTypesForNodesAndEdges = ({
  graphTypeName,
  entities,
  enabled = true,
}: {
  graphTypeName?: string;
  entities: GraphTypeElementOption[];
  enabled?: boolean;
}) => {
  const runGql = useIndexQuery();
  const [items, setItems] = useState<(DescNodeTypeResult | DescEdgeTypeResult)[]>([]);

  // Cache for vector property options
  const propertyCacheRef = useRef<Map<string, typeof items>>(new Map());

  useEffect(() => {
    const fetchVectorProperties = async () => {
      if (!graphTypeName) {
        setItems([]);
        return;
      }

      // Check cache first - include graph_type_name in cache key
      const cacheKey = entities.map((e) => `${e.entity_type}:${e.graph_type_name}`).join(',');
      if (propertyCacheRef.current.has(cacheKey)) {
        setItems(propertyCacheRef.current.get(cacheKey) || []);
        return;
      }

      const nextItems = await getTypesForNodesAndEdges(graphTypeName, runGql);
      setItems(nextItems);
    };

    if (entities.length > 0 && enabled) {
      fetchVectorProperties();
    }
  }, [graphTypeName, entities, enabled]);

  return {
    items,
    setItems,
  };
};
