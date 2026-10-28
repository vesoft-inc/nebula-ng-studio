import type { GraphDataTableValueType, GQLResult, GQLResultPlanInfo } from '@vesoft-inc/studio-core/contracts';

interface GraphNodeRestGQLResult {
  graph: string;
  id: number;
  kind: string;
  labels: string[];
  properties: Record<string, unknown>;
  type: string;
}

interface GraphEdgeRestGQLResult {
  dstId: number;
  graph: string;
  isDirected: boolean;
  kind: string;
  labels: string[];
  properties: Record<string, unknown>;
  rank: number;
  srcId: number;
  type: string;
}

interface GraphPathRestGQLResult {
  kind: string;
  values: (GraphNodeRestGQLResult | GraphEdgeRestGQLResult)[];
}

interface PureTableRestGQLResult {
  [key: string]: string | number | boolean | null;
}

type RestGQLResult = PureTableRestGQLResult | GraphNodeRestGQLResult | GraphEdgeRestGQLResult | GraphPathRestGQLResult;

interface RestGQLResultQueryStats {
  numAffectedEdges: number;
  numAffectedNodes: number;
  numExportedRecords?: number;
  outputPaths?: string[];
}

export interface RestGQLResultSummary {
  elapsedTime: {
    buildTimeUs: number;
    optimizeTimeUs: number;
    parseTimeUs: number;
    serializeTimeUs: number;
    totalServerTimeUs: number;
  };
  explainType: '' | 'profile' | 'explain';
  planInfo: GQLResultPlanInfo;
  queryStats: RestGQLResultQueryStats;
}

export interface RestGqlResultParams {
  code: string;
  cursor: string;
  data?: {
    headers?: string[];
    tables?: Array<Record<string, unknown>>;
  };
  summary: RestGQLResultSummary;
  message: string;
}

// process single node or edge
const processGraphElement = (key: string, value: GraphNodeRestGQLResult | GraphEdgeRestGQLResult) => {
  const type = value?.kind?.toUpperCase() ?? '';

  if (type === 'NODE') {
    const nodeValue = value as GraphNodeRestGQLResult;
    return [
      key,
      {
        raw: `${nodeValue?.id}`,
        type,
        value: {
          ...nodeValue,
        },
      },
    ];
  } else if (type === 'EDGE') {
    const edgeValue = value as GraphEdgeRestGQLResult;
    return [
      key,
      {
        raw: `${edgeValue?.srcId}-[${edgeValue?.type}]->${edgeValue?.dstId}`,
        type,
        value: {
          ...edgeValue,
        },
      },
    ];
  }

  return [key, value];
};

const processPath = (key: string, pathValue: GraphPathRestGQLResult) => {
  const processedValues = pathValue.values.map((item, index) => {
    const [, processedItem] = processGraphElement(`${key}_${index}`, item);
    return (processedItem as { value: GraphNodeRestGQLResult | GraphEdgeRestGQLResult })?.value || processedItem;
  });

  return [
    key,
    {
      raw: pathValue.values
        .map((item) => {
          if (item.kind === 'node') {
            const nodeItem = item as GraphNodeRestGQLResult;
            return `${nodeItem.id}`;
          } else {
            const edgeItem = item as GraphEdgeRestGQLResult;
            return `${edgeItem.srcId}-[${edgeItem.type}]->${edgeItem.dstId}`;
          }
        })
        .join(' -> '),
      type: 'PATH',
      value: processedValues,
    },
  ];
};

export const parseGqlResult = (params: RestGqlResultParams, duration: number): GQLResult => {
  const tables = (params?.data?.tables || []).map((row) => {
    return Object.entries(row as RestGQLResult)
      .map(([key, value]) => {
        if (!value || typeof value !== 'object') {
          return [key, value];
        }

        const kind = value?.kind?.toUpperCase() ?? '';

        if (kind === 'PATH') {
          return processPath(key, value as GraphPathRestGQLResult);
        }
        if (['NODE', 'EDGE'].includes(kind)) {
          return processGraphElement(key, value as GraphNodeRestGQLResult | GraphEdgeRestGQLResult);
        }

        return [key, value];
      })
      .reduce(
        (acc, [key, value]) => {
          Reflect.set(acc, key, value);
          return acc;
        },
        {} as Record<string, GraphDataTableValueType>
      );
  });

  const headers = params?.data?.headers ?? [];

  const rowsCount = params?.data?.tables?.length ?? 0;
  const { elapsedTime, explainType, planInfo } = params.summary ?? {};
  const { buildTimeUs, optimizeTimeUs, totalServerTimeUs, serializeTimeUs } = elapsedTime ?? {};
  const queryStats = params?.summary?.queryStats;
  return {
    headers,
    latency: 0,
    tables,
    duration: duration + totalServerTimeUs,
    summary: {
      buildTimeUs: buildTimeUs,
      explainType,
      serializeTimeUs: serializeTimeUs,
      optimizeTimeUs: optimizeTimeUs,
      rowsCount,
      totalServerTimeUs: totalServerTimeUs,
      planInfo,
      queryStats,
    },
  };
};
