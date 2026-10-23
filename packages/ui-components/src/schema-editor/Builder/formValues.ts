import { IEdgeTypeItem, INodeTypeItem, IProperty } from '../../schema/types';
import { resolveDecimalParameters, PropertyDataType } from '@vesoft-inc/utils';

export const getPropertyModel = (property: IProperty) =>
  new IProperty({
    ...property,
    id: property.id,
    ...(property.type === PropertyDataType.DECIMAL
      ? {
          ...resolveDecimalParameters(property),
        }
      : {}),
  });

// React Hook Form does not clone class instances or their prototype getters.
// Use plain, detached values and an enumerable identity for each property.
export const getPropertyFormValues = (property: IProperty): IProperty => ({ ...property, id: property.id });

export const getNodeTypeFormValues = (node: INodeTypeItem) => ({
  id: node.id,
  name: node.name,
  labels: node.labels.slice(),
  style: { ...node.style },
  properties: node.properties.map(getPropertyFormValues),
});

export const getEdgeTypeFormValues = (edge: IEdgeTypeItem) => ({
  id: edge.id,
  name: edge.name,
  labels: edge.labels.slice(),
  style: { ...edge.style },
  properties: edge.properties.map(getPropertyFormValues),
  srcNode: edge.srcNode,
  dstNode: edge.dstNode,
  direction: edge.direction,
  multiEdgeKeyMode: edge.multiEdgeKeyMode,
});
