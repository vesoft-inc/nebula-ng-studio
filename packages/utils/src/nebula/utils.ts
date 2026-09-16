import { v4 as uuid } from 'uuid';
import { defaultTo } from 'lodash';
import { IProperty } from './interfaces/schema';
import {
  PropertyDataType,
  EdgeDirectionType,
  DecimalTypePattern,
  ListTypePattern,
  SetTypePattern,
  ForwardEdgePattern,
  BackwardEdgePattern,
  UndirectedEdgePattern,
  GeographyTypePattern,
  parseMapTypeSignature,
  VectorTypePattern,
} from '../constant';

// veditor's uuid should be a string without '-'
export const createUuid = (): string => uuid().replaceAll('-', '');

// SchemaManager > GraphTypeBuilder > VisualBuilder util
export function parsePropertyDataType(type: string): Partial<IProperty> {
  if (type.startsWith(PropertyDataType.DECIMAL)) {
    const matched = type.match(DecimalTypePattern);
    if (!matched) {
      return { type: PropertyDataType.DECIMAL, decimalPrecision: 0, decimalScale: 0 };
    }
    const [, decimalPrecision, decimalScale] = matched;
    return {
      type: PropertyDataType.DECIMAL,
      decimalPrecision: Number(decimalPrecision) || 0,
      decimalScale: Number(decimalScale) || 0,
    };
  }
  // GEOGRAPHY(Any) -> GEOGRAPHY
  if (type.toLowerCase().startsWith('geography')) {
    const matched = type.match(GeographyTypePattern);
    if (matched) {
      const [, innerType] = matched;
      if (innerType.toLowerCase() === 'any') {
        return { type: PropertyDataType.GEOGRAPHY };
      }
    }
  }
  if (type.toLowerCase().startsWith('vector')) {
    const matched = type.match(VectorTypePattern);
    if (matched) {
      const [, dimensionCount] = matched;
      return {
        type: PropertyDataType.VECTOR,
        dimensionCount: Number(dimensionCount),
        // itemType: itemType as PropertyDataType,
      };
    }
  }
  if (type.toLocaleLowerCase().startsWith('list')) {
    const matched = type.match(ListTypePattern);
    if (matched) {
      const [, innerType] = matched;
      return { type: PropertyDataType.LIST, itemType: innerType as PropertyDataType };
    }
  }
  if (type.toLocaleLowerCase().startsWith('set')) {
    const matched = type.match(SetTypePattern);
    if (matched) {
      const [, innerType] = matched;
      return { type: PropertyDataType.SET, itemType: innerType as PropertyDataType };
    }
  }
  if (type.toLocaleLowerCase().startsWith('map')) {
    const parsedMapType = parseMapTypeSignature(type);
    if (parsedMapType) {
      const { keyType, valueType } = parsedMapType;
      return {
        type: PropertyDataType.MAP,
        keyType: keyType as PropertyDataType,
        valueType: valueType as PropertyDataType,
      };
    }
  }

  return { type: type as PropertyDataType };
}

export const extractEdgeByEdgeTypeName = (edgeTypeName: string) => {
  const arrs = [ForwardEdgePattern, BackwardEdgePattern, UndirectedEdgePattern];
  for (let i = 0; i < arrs.length; i++) {
    const pattern = arrs[i];
    const matched = edgeTypeName.match(pattern);
    if (!matched) continue;
    const [fromNodeName, name, dstNodeName] = matched.slice(1);
    return {
      fromNodeName,
      name,
      dstNodeName,
      direction: [EdgeDirectionType.Forward, EdgeDirectionType.Backward, EdgeDirectionType.Undirected][i],
    };
  }
  return undefined;
};

export function safeArray<T>(value: T[] | undefined | null): T[] {
  return defaultTo(value, [] as T[]);
}

type EdgeIdentityPart = string | number | bigint | { toString(): string };

export interface GraphEdgeIdentity {
  srcId: EdgeIdentityPart;
  dstId: EdgeIdentityPart;
  rank: EdgeIdentityPart;
  type: string;
  graph: string;
  isDirected: boolean;
}

/**
 * Build a stable edge identity for graph rendering and de-duplication.
 *
 * Undirected edges canonicalize only their endpoints so the same edge returned
 * in the opposite direction is de-duplicated. Graph, edge type and rank remain
 * part of the identity so distinct parallel edges are preserved.
 */
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
