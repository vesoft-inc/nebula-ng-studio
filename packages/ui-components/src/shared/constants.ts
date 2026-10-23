export enum VisualEditorType {
  Tag = 'tag',
  Edge = 'edge',
}

export enum GraphTypeAction {
  Delete = 'delete',
  Add = 'add',
  Modify = 'modify',
}

export enum SchemaItemType {
  GraphType = 'GraphType',
  Graph = 'Graph',
  GraphTypeDescItem = 'GraphTypeDescItem',
  GraphDescItem = 'GraphDescItem',
  EntityTypeDescItem = 'EntityTypeDescItem',
  PropertyDescItem = 'PropertyDescItem',
}

export const EmptyResultId = 'empty-result';

export const DecimalTypePattern = /^DECIMAL\((\d+),\s*(\d+)\)$/;
export const ListTypePattern = /^LIST<(.+)>$/;

export const DEFAULT_SCHEMA_PATH = '/default_schema';

export const ForwardEdgePattern = /\((.*?)\)-\[(.*?)\]->\((.*?)\)/;
export const BackwardEdgePattern = /\((.*?)\)<-\[(.*?)\]-\((.*?)\)/;
export const UndirectedEdgePattern = /\((.*?)\)~\[(.*?)\]~\((.*?)\)/;
