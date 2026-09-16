import JSONBigInt from 'json-bigint';

export enum GraphEntityType {
  Node = 'Node',
  Edge = 'Edge',
}

export enum EdgeDirectionType {
  /** 正向 */
  Forward = 1,
  /** 双向 */
  Bidirect,
  /** 无向 */
  Undirected,
  /** 反向 */
  Backward,
  BackOrUndirected,
  ForwardOrUndirected,
  AnyDirection,
}

export enum MultiEdgeKeyMode {
  /** 不允许平行边 */
  None = 1,
  /** 允许平行边，自增长 */
  Auto,
  /** 允许平行边，自定义属性*/
  Customize,
}

export enum VisualEditorType {
  Tag = 'tag',
  Edge = 'edge',
}

export enum SortType {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const NODE_SIZE = 18;

export enum PropertyDataType {
  STRING = 'STRING',
  INT64 = 'INT64',
  INT32 = 'INT32',
  INT16 = 'INT16',
  INT8 = 'INT8',
  UINT64 = 'UINT64',
  UINT32 = 'UINT32',
  UINT16 = 'UINT16',
  UINT8 = 'UINT8',
  BOOL = 'BOOL',
  FLOAT = 'FLOAT',
  FLOAT32 = 'FLOAT32',
  FLOAT64 = 'FLOAT64',
  DOUBLE = 'DOUBLE',
  LOCAL_DATETIME = 'LOCAL DATETIME',
  ZONED_DATETIME = 'ZONED DATETIME',
  DATE = 'DATE',
  ZONED_TIME = 'ZONED TIME',
  LOCAL_TIME = 'LOCAL TIME',
  DECIMAL = 'DECIMAL',
  LIST = 'LIST',
  SET = 'SET',
  MAP = 'MAP',
  VECTOR = 'VECTOR',
  GEOGRAPHY = 'GEOGRAPHY',
  GEOGRAPHY_ANY = 'GEOGRAPHY(Any)',
  GEOGRAPHY_POINT = 'GEOGRAPHY(Point)',
  GEOGRAPHY_LINESTRING = 'GEOGRAPHY(LineString)',
  GEOGRAPHY_POLYGON = 'GEOGRAPHY(Polygon)',
}

export const GREY_SCALE_ALPHA = 0.2;

export const DateTimeFormat = 'YYYY-MM-DD HH:mm:ss';
export const DateTimeFormat2 = 'YYYY-MM-DD';
export const DateTimeFormat3 = 'YYYY-MM-DD HH:mm';
export const DateTimeFormat4 = 'HH:mm';
export const DateTimeFormat5 = 'MM/DD HH:mm';
export const DateTimeFormat6 = 'HH:mm:ss';
export const DateTimeFormat7 = 'MM/DD';

export enum HttpResCode {
  ErrBadRequest = 40004000,
  ErrParam = 40004001,
  ErrUnauthorized = 40104000,
  ErrSession = 40104001,
  ErrNoClient = 40104002,
  ErrForbidden = 40304000,
  ErrNotFound = 40404000,
  ErrInternalServer = 50004000,
  ErrNotImplemented = 50104000,
  ErrUnknown = 90004000,
}

export const HTTP_CANCEL_CODE = 499;

export const JSONBig = JSONBigInt();

export enum SchemaItemType {
  GraphType = 'GraphType',
  Graph = 'Graph',
  GraphTypeDescItem = 'GraphTypeDescItem',
  GraphDescItem = 'GraphDescItem',
  EntityTypeDescItem = 'EntityTypeDescItem',
  PropertyDescItem = 'PropertyDescItem',
}

export const DecimalTypePattern = /^DECIMAL\((\d+),\s*(\d+)\)$/;
export const ListTypePattern = /^LIST<(.+)>$/;
export const SetTypePattern = /^SET<(.+)>$/;
export const MapTypePattern = /^MAP<(.*)>$/;
export const GeographyTypePattern = /^GEOGRAPHY\((.*)\)$/i;
export const VectorTypePattern = /^VECTOR<(\d+),(.+)>$/;

function splitTopLevelTypeArguments(typeArguments: string): string[] {
  const parts: string[] = [];
  let current = '';
  let angleBracketDepth = 0;
  let parenthesisDepth = 0;

  for (const char of typeArguments) {
    if (char === ',' && angleBracketDepth === 0 && parenthesisDepth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    if (char === '<') {
      angleBracketDepth += 1;
    } else if (char === '>') {
      angleBracketDepth -= 1;
    } else if (char === '(') {
      parenthesisDepth += 1;
    } else if (char === ')') {
      parenthesisDepth -= 1;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

export function parseMapTypeSignature(type: string): { keyType: string; valueType: string } | undefined {
  const matched = type.match(MapTypePattern);
  if (!matched) {
    return undefined;
  }

  const [keyType, valueType, ...extraTypes] = splitTopLevelTypeArguments(matched[1]);
  if (!keyType || !valueType || extraTypes.length > 0) {
    return undefined;
  }

  return { keyType, valueType };
}

export const ForwardEdgePattern = /\((.*?)\)-\[(.*?)\]->\((.*?)\)/;
export const BackwardEdgePattern = /\((.*?)\)<-\[(.*?)\]-\((.*?)\)/;
export const UndirectedEdgePattern = /\((.*?)\)~\[(.*?)\]~\((.*?)\)/;
