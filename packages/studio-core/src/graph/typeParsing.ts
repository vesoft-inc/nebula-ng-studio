import { PropertyDataType, EdgeDirectionType } from '../contracts/constants.js';
import type { PropertyTypeDefinition } from '../contracts/property.js';
import {
  ListTypePattern,
  SetTypePattern,
  ForwardEdgePattern,
  BackwardEdgePattern,
  UndirectedEdgePattern,
  GeographyTypePattern,
  parseMapTypeSignature,
  VectorTypePattern,
} from './patterns.js';
import { parseDecimalType } from './decimal.js';

export function parsePropertyDataType(type: string): PropertyTypeDefinition {
  const decimal = parseDecimalType(type);
  if (decimal) return { type: PropertyDataType.DECIMAL, ...decimal };
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
