// Barrel-free imports (`./identifier`) keep this module free of the React/MUI side of the
// `shared` helpers, so it stays unit-testable.
import { EdgeDirectionType, extractEdgeByEdgeTypeName, GraphEntityType, PropertyDataType } from '@vesoft-inc/utils';
import type { DescGraphTypeResult, DescNodeTypeResult, DescEdgeTypeResult } from '@vesoft-inc/utils';
import { handleKeyword } from './identifier';
import { parseInt64Value } from '../parseInt64Value';

/**
 * Pure helpers for the canvas edit mode.
 *
 * Everything in this module builds/validates v5 ISO-GQL DML statements and is free of
 * store/React dependencies so it can be unit tested. Statement shapes target the
 * NebulaGraph 5.x server DML syntax.
 */

export type PropertyMeta = {
  property_name: string;
  data_type: PropertyDataType;
  /** `nullable === false` means NOT NULL. */
  nullable: boolean;
  /** Raw default expression declared on the graph type, may be `NULL`/empty. */
  default?: string;
  /** Node primary key / edge multi-edge key property. Identity, read-only while editing. */
  isKey: boolean;
};

export type EntityMeta = {
  graph: string;
  type_name: string;
  /**
   * Labels declared on the graph type. Informational only: DML binds the **element type**
   * (`@Type`), because one label may cover several types (see `buildInsertNodeGql`).
   */
  labels: string[];
  entityType: GraphEntityType;
  properties: PropertyMeta[];
  /** `(A)-[E]->(B)` style pattern from the schema, only present on edge types. */
  type_pattern?: string;
};

/** `'Unique' | 'Auto' | string[]` as returned by `describe_graph_type`. */
export type KeyInfo = DescGraphTypeResult['primary_key/multiedge_key'];

export type NodeRef = {
  entityType: GraphEntityType.Node;
  elementId: string;
};

export type EdgeRef = {
  entityType: GraphEntityType.Edge;
  srcId: string;
  dstId: string;
  srcTypeName: string;
  dstTypeName: string;
  rank?: number;
  /** Defaults to `true`; undirected edge types use `~[..]~`. */
  directed?: boolean;
};

export type EntityRef = NodeRef | EdgeRef;

export type PropertyValidationErrorCode =
  | 'required'
  | 'invalidInt'
  | 'invalidNumber'
  | 'invalidBool'
  | 'invalidDate'
  | 'invalidTime'
  | 'invalidDatetime'
  | 'invalidLiteral';

export type EntityValidationErrors = Partial<Record<string, PropertyValidationErrorCode>>;

const NULL_LITERAL = 'NULL';
const NODE_ALIAS = 'v';
const EDGE_ALIAS = 'e';
const SRC_ALIAS = 'a';
const DST_ALIAS = 'b';

const INTEGER_LITERAL_PATTERN = /^[+-]?\d+$/;
const NUMBER_LITERAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const DATE_LITERAL_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_LITERAL_PATTERN = /^\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/;
const DATETIME_LITERAL_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/;

const INT_RANGES: Partial<Record<PropertyDataType, [bigint, bigint]>> = {
  [PropertyDataType.INT8]: [-128n, 127n],
  [PropertyDataType.INT16]: [-32768n, 32767n],
  [PropertyDataType.INT32]: [-2147483648n, 2147483647n],
  [PropertyDataType.INT64]: [-9223372036854775808n, 9223372036854775807n],
  [PropertyDataType.UINT8]: [0n, 255n],
  [PropertyDataType.UINT16]: [0n, 65535n],
  [PropertyDataType.UINT32]: [0n, 4294967295n],
  [PropertyDataType.UINT64]: [0n, 18446744073709551615n],
};

const INTEGER_TYPES = new Set<PropertyDataType>([
  PropertyDataType.INT8,
  PropertyDataType.INT16,
  PropertyDataType.INT32,
  PropertyDataType.INT64,
  PropertyDataType.UINT8,
  PropertyDataType.UINT16,
  PropertyDataType.UINT32,
  PropertyDataType.UINT64,
]);

const FLOAT_TYPES = new Set<PropertyDataType>([
  PropertyDataType.FLOAT,
  PropertyDataType.FLOAT32,
  PropertyDataType.FLOAT64,
  PropertyDataType.DOUBLE,
]);

const DATE_TYPES = new Set<PropertyDataType>([PropertyDataType.DATE]);
const TIME_TYPES = new Set<PropertyDataType>([PropertyDataType.LOCAL_TIME, PropertyDataType.ZONED_TIME]);
const DATETIME_TYPES = new Set<PropertyDataType>([PropertyDataType.LOCAL_DATETIME, PropertyDataType.ZONED_DATETIME]);

/** Types sent verbatim as a GQL literal because the UI cannot model them yet. */
const RAW_LITERAL_TYPES = new Set<PropertyDataType>([
  PropertyDataType.DECIMAL,
  PropertyDataType.LIST,
  PropertyDataType.SET,
  PropertyDataType.MAP,
  PropertyDataType.VECTOR,
  PropertyDataType.GEOGRAPHY,
  PropertyDataType.GEOGRAPHY_ANY,
  PropertyDataType.GEOGRAPHY_POINT,
  PropertyDataType.GEOGRAPHY_LINESTRING,
  PropertyDataType.GEOGRAPHY_POLYGON,
]);

export const buildUseClause = (graph: string) => `USE ${handleKeyword(graph)} `;

export const isNullLike = (value: string | null | undefined) => {
  if (value === undefined || value === null) return true;
  const trimmed = String(value).trim();
  return trimmed === '' || trimmed.toUpperCase() === NULL_LITERAL;
};

export const isIntegerPropertyType = (dataType: PropertyDataType) => INTEGER_TYPES.has(dataType);

export const escapeStringLiteral = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');

/** Builds the right-hand side literal of a property assignment. */
export const encodePropertyLiteral = (value: string | null | undefined, dataType: PropertyDataType): string => {
  if (isNullLike(value)) return NULL_LITERAL;
  const raw = String(value).trim();

  if (DATE_TYPES.has(dataType)) return `date("${escapeStringLiteral(raw)}")`;
  if (TIME_TYPES.has(dataType)) {
    const fn = dataType === PropertyDataType.ZONED_TIME ? 'zoned_time' : 'local_time';
    return `${fn}("${escapeStringLiteral(raw)}")`;
  }
  if (DATETIME_TYPES.has(dataType)) {
    const fn = dataType === PropertyDataType.ZONED_DATETIME ? 'zoned_datetime' : 'local_datetime';
    return `${fn}("${escapeStringLiteral(raw)}")`;
  }

  switch (dataType) {
    case PropertyDataType.STRING:
      return `"${escapeStringLiteral(raw)}"`;
    case PropertyDataType.BOOL:
      return raw.toLowerCase() === 'true' ? 'true' : 'false';
    case PropertyDataType.INT64:
      return String(parseInt64Value(raw, true));
    default:
      // numeric types keep the literal as typed (validated beforehand),
      // raw-literal types are sent verbatim.
      return raw;
  }
};

/** Coerces a value read back from the graph into a string usable by form inputs. */
export const toFormValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const validateValueByType = (raw: string, dataType: PropertyDataType): PropertyValidationErrorCode | undefined => {
  if (INTEGER_TYPES.has(dataType)) {
    if (!INTEGER_LITERAL_PATTERN.test(raw)) return 'invalidInt';
    const range = INT_RANGES[dataType];
    if (range) {
      const parsed = BigInt(raw);
      if (parsed < range[0] || parsed > range[1]) return 'invalidInt';
    }
    return undefined;
  }
  if (FLOAT_TYPES.has(dataType)) {
    return NUMBER_LITERAL_PATTERN.test(raw) ? undefined : 'invalidNumber';
  }
  if (dataType === PropertyDataType.BOOL) {
    const lowered = raw.toLowerCase();
    return lowered === 'true' || lowered === 'false' ? undefined : 'invalidBool';
  }
  if (DATE_TYPES.has(dataType)) {
    return DATE_LITERAL_PATTERN.test(raw) ? undefined : 'invalidDate';
  }
  if (TIME_TYPES.has(dataType)) {
    return TIME_LITERAL_PATTERN.test(raw) ? undefined : 'invalidTime';
  }
  if (DATETIME_TYPES.has(dataType)) {
    return DATETIME_LITERAL_PATTERN.test(raw) ? undefined : 'invalidDatetime';
  }
  if (RAW_LITERAL_TYPES.has(dataType)) {
    return raw.length ? undefined : 'invalidLiteral';
  }
  return undefined;
};

/** `nullable === false` (or being part of the identity) makes the property required. */
export const isPropertyRequired = (property: PropertyMeta) => !property.nullable || property.isKey;

/**
 * Identity properties cannot be changed once the element exists: the server rejects
 * `SET` on them (`NT107` for multi-edge keys), so only non-key properties are editable.
 */
export const getEditableProperties = (meta: EntityMeta) => meta.properties.filter((property) => !property.isKey);

/**
 * Validates the form values of one graph type.
 *
 * `mode: 'edit'` skips identity (key) properties because they are read-only there;
 * the caller is expected to submit only the changed properties.
 */
export const validateEntityValues = (
  meta: EntityMeta,
  values: Record<string, string | null | undefined>,
  mode: 'add' | 'edit'
): EntityValidationErrors => {
  const errors: EntityValidationErrors = {};
  meta.properties.forEach((property) => {
    const isReadonly = mode === 'edit' && property.isKey;
    if (isReadonly) return;
    const value = values[property.property_name];
    if (isNullLike(value)) {
      if (isPropertyRequired(property)) {
        errors[property.property_name] = 'required';
      }
      return;
    }
    const typeError = validateValueByType(String(value).trim(), property.data_type);
    if (typeError) {
      errors[property.property_name] = typeError;
    }
  });
  return errors;
};

/** Initial form values: existing values when editing, declared defaults when adding. */
export const getInitialFormValues = (
  meta: EntityMeta,
  existing?: Record<string, unknown>,
  mode: 'add' | 'edit' = 'add'
): Record<string, string> => {
  const values: Record<string, string> = {};
  meta.properties.forEach((property) => {
    if (mode === 'edit') {
      values[property.property_name] = toFormValue(existing?.[property.property_name]);
      return;
    }
    const declaredDefault = property.default?.trim();
    values[property.property_name] =
      declaredDefault && declaredDefault.toUpperCase() !== NULL_LITERAL ? declaredDefault : '';
  });
  return values;
};

export const buildEntityMeta = (graphType: DescGraphTypeResult, graph: string): EntityMeta => {
  const isNode = graphType.entity_type === GraphEntityType.Node;
  const propertyInfos = (graphType.propertyInfos || []) as Array<DescNodeTypeResult | DescEdgeTypeResult>;
  return {
    graph,
    type_name: graphType.type_name,
    labels: graphType.labels || [],
    entityType: graphType.entity_type,
    type_pattern: graphType.type_pattern,
    properties: propertyInfos.map((info) => ({
      property_name: info.property_name,
      data_type: info.data_type,
      nullable: info.nullable !== false,
      default: info.default,
      isKey: isNode
        ? (info as DescNodeTypeResult).primary_key === 'Y'
        : (info as DescEdgeTypeResult).multi_edge_key === 'Y',
    })),
  };
};

export type EdgeTypeOption = {
  meta: EntityMeta;
  /** `true` when the current selection order must be swapped to match the type direction. */
  reversed: boolean;
  directed: boolean;
};

/**
 * Edge types whose endpoints match the two selected nodes.
 *
 * Undirected types match either order; directed types report `reversed` when the user
 * picked target first.
 */
export const getEligibleEdgeTypeOptions = (params: {
  graph: string;
  edgeTypes: DescGraphTypeResult[];
  sourceTypeName: string;
  targetTypeName: string;
}): EdgeTypeOption[] => {
  const { graph, edgeTypes, sourceTypeName, targetTypeName } = params;
  const options: EdgeTypeOption[] = [];
  edgeTypes.forEach((edgeType) => {
    const pattern = edgeType.type_pattern && extractEdgeByEdgeTypeName(edgeType.type_pattern);
    if (!pattern) return;
    const { fromNodeName, dstNodeName, direction } = pattern;
    const directed = direction !== EdgeDirectionType.Undirected;
    const [realSource, realTarget] =
      direction === EdgeDirectionType.Backward ? [dstNodeName, fromNodeName] : [fromNodeName, dstNodeName];
    const forwardMatched = realSource === sourceTypeName && realTarget === targetTypeName;
    const reversedMatched = realSource === targetTypeName && realTarget === sourceTypeName;
    if (!forwardMatched && !reversedMatched) return;
    options.push({
      meta: buildEntityMeta(edgeType, graph),
      reversed: !forwardMatched && reversedMatched,
      directed,
    });
  });
  return options.sort((a, b) => Number(a.reversed) - Number(b.reversed));
};

const normalizeElementIdLiteral = (id: string | number) => {
  const literal = parseInt64Value(id, true);
  if (typeof literal === 'number') {
    return Number.isNaN(literal) ? `"${escapeStringLiteral(String(id))}"` : String(literal);
  }
  return literal;
};

/**
 * Turns submitted form values into property assignments.
 *
 * Only properties **present in `values`** are considered: `SET` receives a diff of the
 * changed properties, so an absent property means "leave the stored value untouched",
 * while a present-but-empty one means "clear it to NULL".
 */
export const encodeAssignments = (
  meta: EntityMeta,
  values: Record<string, string | null | undefined>,
  options: { skipKeys?: boolean; includeNull?: boolean } = {}
): Array<[string, string]> => {
  const { skipKeys = false, includeNull = false } = options;
  const assignments: Array<[string, string]> = [];
  meta.properties.forEach((property) => {
    if (skipKeys && property.isKey) return;
    if (!(property.property_name in values)) return;
    const value = values[property.property_name];
    if (isNullLike(value)) {
      if (includeNull) assignments.push([property.property_name, NULL_LITERAL]);
      return;
    }
    assignments.push([property.property_name, encodePropertyLiteral(value, property.data_type)]);
  });
  return assignments;
};

const buildPropertyMap = (assignments: Array<[string, string]>) =>
  `{${assignments.map(([name, literal]) => `${handleKeyword(name)}: ${literal}`).join(', ')}}`;

const buildNodePattern = (meta: EntityMeta, elementId: string) =>
  `(${NODE_ALIAS}@${handleKeyword(meta.type_name)} where element_id(${NODE_ALIAS}) = ${normalizeElementIdLiteral(elementId)})`;

const buildEdgePattern = (meta: EntityMeta, ref: EdgeRef) => {
  const rankCondition =
    typeof ref.rank === 'number' && ref.rank !== 0 ? ` where multiedge_id(${EDGE_ALIAS}) = ${ref.rank}` : '';
  const src = `(${SRC_ALIAS}@${handleKeyword(ref.srcTypeName)} where element_id(${SRC_ALIAS}) = ${normalizeElementIdLiteral(
    ref.srcId
  )})`;
  const dst = `(${DST_ALIAS}@${handleKeyword(ref.dstTypeName)} where element_id(${DST_ALIAS}) = ${normalizeElementIdLiteral(
    ref.dstId
  )})`;
  const edge = `[${EDGE_ALIAS}@${handleKeyword(meta.type_name)}${rankCondition}]`;
  return ref.directed === false ? `${src}~${edge}~${dst}` : `${src}-${edge}->${dst}`;
};

export const buildInsertNodeGql = (params: { meta: EntityMeta; values: Record<string, string> }) => {
  const { meta, values } = params;
  // The element type (`@Type`) is required instead of the label (`:Label`): a label can be
  // shared by several node types (e.g. `Person` covers Actor / Director / User in `movie`),
  // and the server rejects the ambiguous label form with `NC009`.
  const typeSpec = `@${handleKeyword(meta.type_name)}`;
  const assignments = encodeAssignments(meta, values);
  return `${buildUseClause(meta.graph)}INSERT (${typeSpec}${buildPropertyMap(assignments)})`;
};

export const buildInsertEdgeGql = (params: {
  meta: EntityMeta;
  src: { id: string; typeName: string };
  dst: { id: string; typeName: string };
  values: Record<string, string>;
  directed: boolean;
}) => {
  const { meta, src, dst, values, directed } = params;
  const srcPattern = `(${SRC_ALIAS}@${handleKeyword(src.typeName)} where element_id(${SRC_ALIAS}) = ${normalizeElementIdLiteral(
    src.id
  )})`;
  const dstPattern = `(${DST_ALIAS}@${handleKeyword(dst.typeName)} where element_id(${DST_ALIAS}) = ${normalizeElementIdLiteral(
    dst.id
  )})`;
  const assignments = encodeAssignments(meta, values);
  // Same reasoning as `buildInsertNodeGql`: bind the element type, never the label.
  const edge = `[@${handleKeyword(meta.type_name)}${buildPropertyMap(assignments)}]`;
  const sequence = directed ? `-${edge}->` : `~${edge}~`;
  return `${buildUseClause(meta.graph)}MATCH ${srcPattern}, ${dstPattern} INSERT (${SRC_ALIAS})${sequence}(${DST_ALIAS})`;
};

export const buildSetPropertiesGql = (params: {
  meta: EntityMeta;
  ref: EntityRef;
  values: Record<string, string | null | undefined>;
}) => {
  const { meta, ref, values } = params;
  const assignments = encodeAssignments(meta, values, { skipKeys: true, includeNull: true });
  const setClause = assignments
    .map(
      ([name, literal]) =>
        `${ref.entityType === GraphEntityType.Node ? NODE_ALIAS : EDGE_ALIAS}.${handleKeyword(name)} = ${literal}`
    )
    .join(', ');
  const pattern =
    ref.entityType === GraphEntityType.Node ? buildNodePattern(meta, ref.elementId) : buildEdgePattern(meta, ref);
  return `${buildUseClause(meta.graph)}MATCH ${pattern} SET ${setClause}`;
};

export const buildDeleteGql = (params: { meta: EntityMeta; ref: EntityRef }) => {
  const { meta, ref } = params;
  if (ref.entityType === GraphEntityType.Node) {
    return `${buildUseClause(meta.graph)}MATCH ${buildNodePattern(meta, ref.elementId)} DETACH DELETE ${NODE_ALIAS}`;
  }
  return `${buildUseClause(meta.graph)}MATCH ${buildEdgePattern(meta, ref)} DELETE ${EDGE_ALIAS}`;
};

/** Read the newly inserted node back by its primary key (DML cannot return data itself). */
export const buildReadBackNodeGql = (params: { meta: EntityMeta; values: Record<string, string> }) => {
  const { meta, values } = params;
  const keys = meta.properties.filter((property) => property.isKey);
  if (!keys.length) return undefined;
  const condition = keys
    .map(
      (property) =>
        `${NODE_ALIAS}.${handleKeyword(property.property_name)} = ${encodePropertyLiteral(values[property.property_name], property.data_type)}`
    )
    .join(' AND ');
  return `${buildUseClause(meta.graph)}MATCH (${NODE_ALIAS}@${handleKeyword(meta.type_name)} where ${condition}) RETURN ${NODE_ALIAS} LIMIT 1`;
};

/** Read the newly inserted edge (with its endpoints) back after the DML statement ran. */
export const buildReadBackEdgeGql = (params: {
  meta: EntityMeta;
  src: { id: string; typeName: string };
  dst: { id: string; typeName: string };
  values?: Record<string, string>;
  directed: boolean;
}) => {
  const { meta, src, dst, values, directed } = params;
  const srcPattern = `(${SRC_ALIAS}@${handleKeyword(src.typeName)} where element_id(${SRC_ALIAS}) = ${normalizeElementIdLiteral(
    src.id
  )})`;
  const dstPattern = `(${DST_ALIAS}@${handleKeyword(dst.typeName)} where element_id(${DST_ALIAS}) = ${normalizeElementIdLiteral(
    dst.id
  )})`;
  const keyConditions = (values ? meta.properties.filter((property) => property.isKey) : [])
    .filter((property) => !isNullLike(values?.[property.property_name]))
    .map(
      (property) =>
        `${EDGE_ALIAS}.${handleKeyword(property.property_name)} = ${encodePropertyLiteral(
          values?.[property.property_name],
          property.data_type
        )}`
    );
  const edge = `[${EDGE_ALIAS}@${handleKeyword(meta.type_name)}${
    keyConditions.length ? ` where ${keyConditions.join(' AND ')}` : ''
  }]`;
  const pattern = directed ? `${srcPattern}-${edge}->${dstPattern}` : `${srcPattern}~${edge}~${dstPattern}`;
  return `${buildUseClause(meta.graph)}MATCH ${pattern} RETURN ${SRC_ALIAS}, ${EDGE_ALIAS}, ${DST_ALIAS}`;
};
