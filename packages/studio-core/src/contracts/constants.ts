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

export enum SortType {
  ASC = 'ASC',
  DESC = 'DESC',
}

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
