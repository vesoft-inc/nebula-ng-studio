export { LINE_STYLE, ToolNodeColor } from '../shared/styles';
import type { GraphType, GraphItem, GraphTypeElement, DescTypeItemResult } from '@vesoft-inc/studio-core/contracts';
export type {
  ISchemaItem,
  NebulaSchema,
  GraphType,
  GraphItem,
  GraphTypeElement,
  ILabelItem,
  DescTypeItemResult,
  DescNodeTypeResult,
  DescEdgeTypeResult,
  IGraphIndex,
  IGraphStats,
} from '@vesoft-inc/studio-core/contracts';
export type { RawGraphTypeDescription as DescGraphTypeResult } from '@vesoft-inc/studio-core/contracts';
export { EdgeStatsEntryName, NodeStatsEntryName } from '@vesoft-inc/studio-core/contracts';
import { LINE_STYLE } from '../shared/styles';
import { createUuid } from '@vesoft-inc/studio-core';
import { EdgeDirectionType, MultiEdgeKeyMode, PropertyDataType } from '@vesoft-inc/studio-core/contracts';
import { SchemaItemType, VisualEditorType } from '../shared/constants';

export const idSymbol = Symbol('id');
export const styleSymbol = Symbol('style');
export class IProperty {
  name: string;
  type: PropertyDataType;
  isPrimaryKey?: boolean = false;
  multiEdgeKey?: boolean = false;
  default?: string;
  nullable?: boolean = false;
  decimalPrecision?: number; // DECIMAL precision: 1..256
  decimalScale?: number; // DECIMAL scale: 0..128, no greater than precision
  itemType?: PropertyDataType; // item type for LIST/SET properties
  keyType?: PropertyDataType; // key type for MAP properties
  valueType?: PropertyDataType; // value type for MAP properties
  dimensionCount?: number; // dimension count for VECTOR properties
  [idSymbol]: string;

  constructor(params?: Partial<IProperty>) {
    this.name = params?.name || '';
    this.type = params?.type || PropertyDataType.STRING;
    this.isPrimaryKey = params?.isPrimaryKey;
    this.multiEdgeKey = params?.multiEdgeKey;
    this.default = params?.default;
    this.nullable = params?.nullable;
    this.decimalPrecision = params?.decimalPrecision;
    this.decimalScale = params?.decimalScale;
    this.itemType = params?.itemType;
    this.keyType = params?.keyType;
    this.valueType = params?.valueType;
    this.dimensionCount = params?.dimensionCount;
    this[idSymbol] = params?.id || createUuid();
  }

  get id() {
    return this[idSymbol];
  }
}

export class INodeTypeItem {
  private [idSymbol]: string;
  name: string;
  properties: IProperty[] = [];
  labels: string[] = [];
  style?: VisualInfo;

  constructor(params?: Partial<Pick<INodeTypeItem, 'name' | 'properties' | 'labels' | 'style'>> & { id?: string }) {
    this[idSymbol] = params?.id || createUuid();
    this.name = params?.name || '';
    this.properties = (params?.properties || []).map((property) => {
      const newProperty = new IProperty(property);
      return newProperty;
    });
    this.labels = params?.labels || [];
    this.style = params?.style || {};
  }

  get id() {
    return this[idSymbol];
  }

  updateValues(values: Partial<Pick<INodeTypeItem, 'name' | 'properties' | 'labels' | 'style'>>) {
    if (!values) return;
    if (values.name !== undefined) {
      this.name = values.name;
    }
    if (values.properties !== undefined) {
      this.properties = values.properties;
    }
    if (values.labels !== undefined) {
      this.labels = values.labels;
    }
    if (values.style !== undefined) {
      this.style = values.style;
    }
  }

  setName = (name: string) => {
    this.name = name;
  };

  clone = ({ style }: { style?: INodeTypeItem['style'] } = {}) => {
    const node = new INodeTypeItem();
    node.name = `${this.name}_copy`;
    node.properties = this.properties.map((property) => {
      const newProperty = new IProperty(property);
      return newProperty;
    });
    node.labels = this.labels.slice();
    node.style = {
      ...this.style,
      x: this.style?.x ? this.style.x + 100 : 100,
      y: this.style?.y ? this.style.y : 100,
      ...style,
    };
    return node;
  };
}

export class IEdgeTypeItem {
  private [idSymbol]: string;
  name: string;
  properties: IProperty[] = [];
  labels: string[] = [];
  srcNode: INodeTypeItem;
  dstNode: INodeTypeItem;
  direction: EdgeDirectionType;
  multiEdgeKeyMode: MultiEdgeKeyMode;
  style?: VisualInfo;

  constructor(
    params?: Partial<
      Pick<
        IEdgeTypeItem,
        'name' | 'properties' | 'labels' | 'srcNode' | 'dstNode' | 'direction' | 'style' | 'multiEdgeKeyMode' | 'id'
      >
    >
  ) {
    this[idSymbol] = params?.id || createUuid();
    this.name = params?.name ?? '';
    this.srcNode = params?.srcNode || new INodeTypeItem();
    this.dstNode = params?.dstNode || new INodeTypeItem();
    this.properties = params?.properties || [];
    this.labels = params?.labels || [];
    this.direction = params?.direction || EdgeDirectionType.Forward;
    this.multiEdgeKeyMode = params?.multiEdgeKeyMode || MultiEdgeKeyMode.None;
    this.style = params?.style || {
      strokeColor: LINE_STYLE.stroke,
    };
  }

  get id() {
    return this[idSymbol];
  }

  setName = (name: string) => {
    this.name = name;
  };

  /**
   * Update the edge values with partial properties, only assigning those fields that exist in `values`.
   * @param values - Partial values to update
   */
  updateValues = (
    values: Partial<
      Pick<
        IEdgeTypeItem,
        'name' | 'properties' | 'labels' | 'srcNode' | 'dstNode' | 'direction' | 'style' | 'multiEdgeKeyMode'
      >
    >
  ) => {
    if (values.name !== undefined) {
      this.name = values.name;
    }
    if (values.properties !== undefined) {
      this.properties = values.properties;
    }
    if (values.labels !== undefined) {
      this.labels = values.labels;
    }
    if (values.srcNode !== undefined) {
      this.srcNode = values.srcNode;
    }
    if (values.dstNode !== undefined) {
      this.dstNode = values.dstNode;
    }
    if (values.direction !== undefined) {
      this.direction = values.direction;
    }
    if (values.multiEdgeKeyMode !== undefined) {
      this.multiEdgeKeyMode = values.multiEdgeKeyMode;
    }
    if (values.style !== undefined) {
      this.style = values.style;
    }
  };

  clone = () => {
    const edge = new IEdgeTypeItem();
    edge.name = `${this.name}_copy`;
    edge.properties = this.properties.map((property) => {
      const newProperty = new IProperty(property);
      return newProperty;
    });
    edge.labels = this.labels.slice();
    edge.direction = this.direction;
    edge.multiEdgeKeyMode = this.multiEdgeKeyMode;
    edge.style = {
      ...this.style,
      x: this.style?.x ? this.style.x + 100 : 100,
      y: this.style?.y ? this.style.y : 100,
    };
    edge.srcNode = this.srcNode;
    edge.dstNode = this.dstNode;
    return edge;
  };
}

export interface VisualInfo {
  fill?: string;
  strokeColor?: string;
  shadow?: string;
  x?: number;
  y?: number;
  /** for graph canvas */
  position?: { x: number; y: number };
  [key: string]: unknown;
}

/** Canvas position of a node type in the schema visual builder. */
export interface NodePosition {
  x: number;
  y: number;
}

/** Node type name -> canvas position. */
export type NodeLayoutMap = Record<string, NodePosition>;

export interface VisualNodeCustomizeInfo {
  fill?: string;
  strokeColor?: string;
  shadow?: string;
  type?: VisualEditorType.Tag;
  name?: string;
  comment?: string;
  invalid?: false;
}

export interface ISketchItem {
  id?: number;
  name: string;
  ifNotExists?: boolean;
  schema: string;
  snapshot: string;
  createTime?: string;
  updateTime?: string;
}

export type SketchListItem = {
  items: ISketchItem[];
  total: number;
  page: number;
  pageSize: number;
};

export interface IUserInfo {
  address: string;
  username: string;
  coreVersion: string;
  version: string; // studio version
  curSchemaPath: string;
  roles: string[];
  createdTime: string;
}

export interface ISchemaTreeRawData {
  type: SchemaItemType;
  graphType?: GraphType;
  graph?: GraphItem;
  entity?: GraphTypeElement;
  property?: DescTypeItemResult;
}

export enum GraphTypeBuildMode {
  Edit = 'edit',
  Create = 'create',
  Readonly = 'readonly',
  Sketch = 'sketch',
}
