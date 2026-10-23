import {
  EdgeDirectionType,
  MultiEdgeKeyMode,
  PropertyDataType,
  resolveDecimalParameters,
  parsePropertyDataType as parseSharedPropertyDataType,
} from '@vesoft-inc/utils';
import { IEdgeTypeItem, INodeTypeItem, IProperty } from '../../../schema/types';
import { RawEntityType } from '../../../graph/types/console';
import { isEqualIgnoringFields } from '../../../shared/utilities';
import { getNewNodeTypes } from '../validation';

interface GraphTypeInfo {
  graphTypeName: string;
  nodeTypeList: INodeTypeItem[];
  edgeTypeList: IEdgeTypeItem[];
  ifNotExists?: boolean;
}

const isSameEntity = (
  original: INodeTypeItem | IEdgeTypeItem | IProperty,
  current: INodeTypeItem | IEdgeTypeItem | IProperty
) => {
  return original.id === current.id || original.name === current.name;
};

export function generateAlterGraphTypeGQL(original: GraphTypeInfo, current: GraphTypeInfo) {
  if (original.graphTypeName !== current.graphTypeName) {
    return `RENAME GRAPH TYPE \`${original.graphTypeName}\` TO \`${current.graphTypeName}\`\n`;
  }
  const createNodeTypeList = getNewNodeTypes(original.nodeTypeList, current.nodeTypeList);
  const dropNodeTypeList = original.nodeTypeList.filter(
    (nodeType) => !current.nodeTypeList.find((nt) => isSameEntity(nt, nodeType))
  );
  const createEdgeTypeList = current.edgeTypeList.filter(
    (edgeType) => !original.edgeTypeList.find((ot) => isSameEntity(ot, edgeType))
  );
  const dropEdgeTypeList = original.edgeTypeList.filter(
    (edgeType) => !current.edgeTypeList.find((et) => isSameEntity(et, edgeType))
  );
  const alterNodeTypeList = current.nodeTypeList.filter((nodeType) => {
    const originalNodeType = original.nodeTypeList.find((ot) => isSameEntity(ot, nodeType));
    if (!originalNodeType) return false;
    return !isEqualIgnoringFields<INodeTypeItem>(nodeType, originalNodeType, ['style']);
  });
  const alterEdgeTypeList = current.edgeTypeList.filter((edgeType) => {
    const originalEdgeType = original.edgeTypeList.find((ot) => isSameEntity(ot, edgeType));
    if (!originalEdgeType) return false;
    return !isEqualIgnoringFields<IEdgeTypeItem>(edgeType, originalEdgeType, ['style', 'srcNode', 'dstNode']);
  });
  const createNodeTypeGql = createNodeTypeList
    .map((nodeType) => '  ADD ' + generateNodeTypeSubGQL(nodeType))
    .join(',\n');
  const dropNodeTypeGql = dropNodeTypeList
    .map((nodeType) => '  DROP ' + generateNodeTypeSubGQL(nodeType, false))
    .join(',\n');
  const createEdgeTypeGql = createEdgeTypeList
    .map((nodeType) => '  ADD ' + generateEdgeTypeSubGQL(nodeType))
    .join(',\n');
  const dropEdgeTypeGql = dropEdgeTypeList
    .map((nodeType) => '  DROP ' + generateEdgeTypeSubGQL(nodeType, false))
    .join(',\n');
  const alterNodeTypeGql = alterNodeTypeList
    .map((nodeType) => generateAlterEntityTypeGQL(nodeType, original.nodeTypeList, RawEntityType.NODE))
    .filter(Boolean)
    .map((gql) => '  ' + gql)
    .join(',\n');
  const alterEdgeTypeGql = alterEdgeTypeList
    .map((edgeType) => generateAlterEntityTypeGQL(edgeType, original.edgeTypeList, RawEntityType.EDGE))
    .filter(Boolean)
    .map((gql) => '  ' + gql)
    .join(',\n');
  const alterContent = [
    alterEdgeTypeGql,
    createNodeTypeGql,
    dropNodeTypeGql,
    createEdgeTypeGql,
    dropEdgeTypeGql,
    alterNodeTypeGql,
  ]
    .filter((subGql) => subGql.length > 0)
    .join(',\n');
  return alterContent.trim().length ? `ALTER GRAPH TYPE \`${current.graphTypeName}\` {\n` + alterContent + `\n}` : '';
}

export function generateCreateGraphTypeGQL(graphTypeInfo: GraphTypeInfo) {
  const { graphTypeName, nodeTypeList, edgeTypeList } = graphTypeInfo;
  const ngql = `CREATE GRAPH TYPE \`${graphTypeName}\` AS {
${nodeTypeList
  .map((nodeType) => '  ' + generateNodeTypeSubGQL(nodeType))
  .concat(edgeTypeList.map((edgeType) => '  ' + generateEdgeTypeSubGQL(edgeType)))
  .join(',\n')}
}`;
  return ngql;
}

function generateDefaultValue(property: IProperty) {
  if (!property.default) return '';
  if (property.type.includes('STRING')) {
    return `'${property.default}'`;
  }
  if (property.type.includes('INT')) {
    return property.default;
  }
  return property.default;
}

function generateNodeTypeSubGQL(nodeType: INodeTypeItem, showDetail = true) {
  if (!showDetail) return `NODE \`${nodeType.name}\``;
  let label = '';
  if (nodeType.labels.length > 0) {
    label += nodeType.labels.length > 1 ? 'LABELS ' : 'LABEL ';
    label += nodeType.labels.map((label) => `\`${label}\``).join('&');
  }
  let property = ``;
  if (nodeType.properties.length > 0) {
    const primaryKeys = nodeType.properties.filter((p) => p.isPrimaryKey).map((p) => `\`${p.name}\``);
    const primaryKey = primaryKeys.length > 0 ? `, PRIMARY KEY(${primaryKeys.join(',')})` : '';
    property += `{${nodeType.properties.map(generatePropertyGQL).join(',')}${primaryKey}}`;
  }
  return `NODE \`${nodeType.name}\` (${label} ${property})`;
}

function generatePropertyGQL(property: IProperty) {
  const items = [];
  items.push(`\`${property.name}\``);
  let type: string = property.type;

  if (type === PropertyDataType.DECIMAL) {
    // Cleared number inputs can be empty strings; an explicit zero scale is not empty.
    const precision = property.decimalPrecision?.toString().trim();
    const scale = property.decimalScale?.toString().trim();
    if (!precision && !scale) {
      type = `${PropertyDataType.DECIMAL}`;
    } else {
      const parameters = resolveDecimalParameters(property);
      type = `${PropertyDataType.DECIMAL}(${parameters.decimalPrecision}, ${parameters.decimalScale})`;
    }
  } else if (property.type === PropertyDataType.LIST) {
    type = `LIST<${property.itemType || PropertyDataType.STRING}>`;
  } else if (property.type === PropertyDataType.SET) {
    type = `SET<${property.itemType || PropertyDataType.STRING}>`;
  } else if (property.type === PropertyDataType.MAP) {
    type = `MAP<${property.keyType || PropertyDataType.STRING}, ${property.valueType || PropertyDataType.STRING}>`;
  } else if (property.type === PropertyDataType.VECTOR) {
    type = `VECTOR<${property.dimensionCount ?? 1}, FLOAT>`; // 目前只支持 FLOAT
  }

  items.push(type);
  property.nullable === false && items.push('NOT NULL');
  property.default && items.push(`DEFAULT ${generateDefaultValue(property)}`);
  return items.join(' ');
}

function generateAlterEntityTypeGQL(
  currentEntity: IEdgeTypeItem | INodeTypeItem,
  originEntities: IEdgeTypeItem[] | INodeTypeItem[],
  type: RawEntityType
) {
  const originEntity = originEntities.find((entity) => entity.id === currentEntity.id);
  if (!originEntity) return '';
  if (originEntity.name !== currentEntity.name) {
    return `RENAME ${type} \`${originEntity.name}\` TO \`${currentEntity.name}\``;
  }
  const addLabels = currentEntity.labels.filter((label) => !originEntity.labels.includes(label));
  const dropLabels = originEntity.labels.filter((label) => !currentEntity.labels.includes(label));
  const addProperties = currentEntity.properties.filter(
    (property) => !originEntity.properties.find((ot) => isSameEntity(ot, property))
  );
  const dropProperties = originEntity.properties.filter(
    (property) => !currentEntity.properties.find((et) => isSameEntity(et, property))
  );
  const renameProperties: {
    originName: string;
    name: string;
  }[] = currentEntity.properties
    .filter((property) => {
      const originProperty = originEntity.properties.find((ot) => ot.id === property.id);
      if (!originProperty) return false;
      return originProperty.name !== property.name;
    })
    .map((property) => {
      const originProperty = originEntity.properties.find((ot) => ot.id === property.id);
      return { originName: originProperty!.name, name: property.name };
    });
  const modifyProperties = currentEntity.properties.filter((property) => {
    const originProperty = originEntity.properties.find((ot) => ot.id === property.id);
    if (!originProperty) return false;
    // Omitted DECIMAL parameters and their effective defaults describe the same type.
    if (property.type === PropertyDataType.DECIMAL && originProperty.type === PropertyDataType.DECIMAL) {
      return !isEqualIgnoringFields<IProperty>(
        { ...property, id: property.id, ...resolveDecimalParameters(property) },
        { ...originProperty, id: originProperty.id, ...resolveDecimalParameters(originProperty) },
        ['name', 'isPrimaryKey']
      );
    }
    return !isEqualIgnoringFields<IProperty>(property, originProperty, ['name', 'isPrimaryKey']);
  });
  const addLabelGql = addLabels.length > 0 ? `ADD LABELS ${addLabels.map((label) => `\`${label}\``).join('&')}` : '';
  const dropLabelGql =
    dropLabels.length > 0 ? `DROP LABELS ${dropLabels.map((label) => `\`${label}\``).join('&')}` : '';
  const addPropertyGql =
    addProperties.length > 0
      ? `ADD PROPERTIES {` + addProperties.map((property) => generatePropertyGQL(property)).join(',') + '}'
      : '';
  const dropPropertyGql =
    dropProperties.length > 0
      ? `DROP PROPERTIES {` + dropProperties.map((property) => `\`${property.name}\``).join(',') + '}'
      : '';
  const modifyPropertyGql =
    modifyProperties.length > 0
      ? `MODIFY PROPERTIES {` + modifyProperties.map((property) => generatePropertyGQL(property)).join(', ') + `}`
      : '';
  const renamePropertyGql =
    renameProperties.length > 0
      ? `RENAME PROPERTIES {` +
        renameProperties.map((item) => `\`${item.originName}\` TO \`${item.name}\``).join(', ') +
        `}`
      : '';
  const alterContent = [
    addLabelGql,
    dropLabelGql,
    addPropertyGql,
    dropPropertyGql,
    modifyPropertyGql,
    renamePropertyGql,
  ]
    .filter((subGql) => subGql.length > 0)
    .join(' ');
  if (!alterContent) return '';
  return `ALTER ${type} \`${currentEntity.name}\` ${alterContent}`;
}

function generateEdgeTypeSubGQL(edgeType: IEdgeTypeItem, showDetail = true) {
  if (!showDetail) return `EDGE \`${edgeType.name}\``;
  let label = '';
  if (edgeType.labels.length > 0) {
    label += edgeType.labels.length > 1 ? 'LABELS ' : 'LABEL ';
    label += edgeType.labels.map((label) => `\`${label}\``).join('&');
  }
  let multiEdge = '';
  if (edgeType.multiEdgeKeyMode === MultiEdgeKeyMode.Auto) {
    multiEdge = 'MULTIEDGE KEY()';
  } else if (edgeType.multiEdgeKeyMode === MultiEdgeKeyMode.Customize) {
    const multiEdgeKeyItems = edgeType.properties.filter((p) => p.multiEdgeKey);
    multiEdge = `MULTIEDGE KEY(${multiEdgeKeyItems.map((p) => `\`${p.name}\``).join(',')})`;
  }
  let property = ``;
  if (edgeType.properties.length > 0) {
    property += `${edgeType.properties.map((property) => generatePropertyGQL(property))}`;
    if (multiEdge.length > 0) {
      property += ',';
    }
  }
  property = `{${property}${multiEdge}}`;

  let directions = ['-', '->'];
  if (edgeType.direction === EdgeDirectionType.Backward) {
    directions = ['<-', '-'];
  } else if (edgeType.direction === EdgeDirectionType.Undirected) {
    directions = ['~', '~'];
  }
  return `EDGE \`${edgeType.name}\` (\`${edgeType.srcNode.name}\`)${directions[0]}[${label} ${property}]${directions[1]}(\`${edgeType.dstNode.name}\`)`;
}

export const parsePropertyDataType = (type: string): Partial<IProperty> =>
  parseSharedPropertyDataType(type) as Partial<IProperty>;
