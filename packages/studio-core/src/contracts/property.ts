import type { PropertyDataType } from './constants.js';

/** Parsed data type parameters, independent of editor identity and layout. */
export interface PropertyTypeDefinition {
  type: PropertyDataType;
  itemType?: PropertyDataType;
  keyType?: PropertyDataType;
  valueType?: PropertyDataType;
  decimalPrecision?: number;
  decimalScale?: number;
  dimensionCount?: number;
}
