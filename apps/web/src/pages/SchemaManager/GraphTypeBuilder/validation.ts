import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem, IProperty } from '@studio/interfaces';
import {
  getDecimalParameterError,
  parseDecimalType,
  PropertyDataType,
  resolveDecimalParameters,
} from '@vesoft-inc/utils';

export function getPropertyDecimalError(property: IProperty): boolean {
  if (/^\s*(DECIMAL|DEC)\s*$/i.test(property.type)) return !!getDecimalParameterError(property);
  if (/^\s*(DECIMAL|DEC)\b/i.test(property.type)) {
    const parsed = parseDecimalType(property.type);
    return !parsed || !!getDecimalParameterError(parsed);
  }
  return false;
}

export function validateGraphTypeDecimals(nodes: INodeTypeItem[], edges: IEdgeTypeItem[]) {
  return [...nodes, ...edges].flatMap((entity) =>
    entity.properties.filter(getPropertyDecimalError).map((property) => ({ entity, property }))
  );
}

type NodeIdentity = Pick<INodeTypeItem, 'id' | 'name'>;
export type NodePrimaryKeyError = 'nodePrimaryKeyRequired' | 'nodePrimaryKeyInvalid' | 'nodePrimaryKeyImmutable';

export const getOriginalNodeType = (original: INodeTypeItem[], current: NodeIdentity) =>
  original.find((node) => node.id === current.id) || original.find((node) => node.name === current.name);

// Keep ADD NODE validation and DDL generation on the same identity rule.
export const getNewNodeTypes = <T extends NodeIdentity>(original: NodeIdentity[], current: T[]): T[] =>
  current.filter((node) => !original.some((item) => item.id === node.id || item.name === node.name));

/** CREATE GRAPH TYPE requires one nonempty key; multiple selected properties form a composite key. */
export const getNodePrimaryKeyError = (
  node: Pick<INodeTypeItem, 'properties'>,
  original?: Pick<INodeTypeItem, 'properties'>
): NodePrimaryKeyError | null => {
  const keys = node.properties.filter((property) => property.isPrimaryKey);
  if (original) {
    const originalKeys = original.properties.filter((property) => property.isPrimaryKey);
    const changed =
      keys.length !== originalKeys.length ||
      originalKeys.some((property) => {
        const current = keys.find((key) => key.id === property.id) || keys.find((key) => key.name === property.name);
        return (
          !current ||
          current.type !== property.type ||
          (property.type === PropertyDataType.DECIMAL &&
            (resolveDecimalParameters(current).decimalPrecision !==
              resolveDecimalParameters(property).decimalPrecision ||
              resolveDecimalParameters(current).decimalScale !== resolveDecimalParameters(property).decimalScale)) ||
          !!current.nullable !== !!property.nullable ||
          (current.default || '') !== (property.default || '')
        );
      });
    if (changed) return 'nodePrimaryKeyImmutable';
  }
  if (!keys.length) return 'nodePrimaryKeyRequired';
  const invalid = keys.some(
    (property) =>
      !property.name.trim() ||
      property.nullable === true ||
      !!property.default ||
      [PropertyDataType.LIST, PropertyDataType.SET, PropertyDataType.MAP, PropertyDataType.VECTOR].includes(
        property.type
      ) ||
      property.type.startsWith(PropertyDataType.GEOGRAPHY)
  );
  return invalid ? 'nodePrimaryKeyInvalid' : null;
};

export const validateGraphTypePrimaryKeys = ({
  mode,
  nodeTypeList,
  originalNodeTypeList = [],
  graphTypeName,
  originalGraphTypeName,
}: {
  mode: GraphTypeBuildMode;
  nodeTypeList: INodeTypeItem[];
  originalNodeTypeList?: INodeTypeItem[];
  graphTypeName?: string;
  originalGraphTypeName?: string;
}): { node: INodeTypeItem; error: NodePrimaryKeyError }[] => {
  if (mode === GraphTypeBuildMode.Readonly) return [];
  // The generator emits only RENAME GRAPH TYPE when the name changes.
  if (mode === GraphTypeBuildMode.Edit && graphTypeName !== originalGraphTypeName) return [];
  return nodeTypeList.flatMap((node) => {
    const original = mode === GraphTypeBuildMode.Edit ? getOriginalNodeType(originalNodeTypeList, node) : undefined;
    const error = getNodePrimaryKeyError(node, original);
    return error ? [{ node, error }] : [];
  });
};
