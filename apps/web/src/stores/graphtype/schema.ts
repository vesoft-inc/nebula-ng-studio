import { type IReactionDisposer, computed, makeAutoObservable, observable, reaction } from 'mobx';
import { GQLResult, GraphEntityType, MultiEdgeKeyMode, parsePropertyDataType } from '@vesoft-inc/utils';

import { cloneDeep } from 'lodash';
import groupBy from 'lodash/groupBy';
import {
  DescEdgeTypeResult,
  DescGraphTypeResult,
  DescNodeTypeResult,
  IEdgeTypeItem,
  INodeTypeItem,
  IProperty,
  VisualInfo,
} from '@studio/interfaces';
import { execGql, getSketchById } from '@studio/services';
import { RootStore } from '@studio/stores/index';
import { VisualEditorType } from '@studio/utils/constant';
import { extractEdgeByEdgeTypeName } from '@studio/utils';
import randomColor from 'randomcolor';
import { alpha } from '@mui/material';

export type ActiveItemInfo =
  | { type: VisualEditorType.Edge; value: IEdgeTypeItem }
  | { type: VisualEditorType.Tag; value: INodeTypeItem };

class SchemaStore {
  rootStore?: RootStore;
  activeItem?: ActiveItemInfo;
  originalNodeTypeList: INodeTypeItem[] = [];
  originalEdgeTypeList: IEdgeTypeItem[] = [];
  nodeTypeList = observable.array<INodeTypeItem>([], { deep: false });
  edgeTypeList = observable.array<IEdgeTypeItem>([], { deep: false });

  // Container dimensions for initial position calculations
  containerWidth = 800;
  containerHeight = 600;

  reactionDisposer?: IReactionDisposer;
  activeItemDisposer?: IReactionDisposer;

  graphtypeName?: string;

  constructor(rootStore?: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {
      activeItem: observable.ref,
      nodeTypeLabeMap: computed,
      edgeTypeLabelMap: computed,
    });
    this.initReactions();
  }

  // Transform data from DDL to editor
  transformGraphTypeToEditorFromDDL = async (graphTypeName: string) => {
    this.updateGraphTypeName(graphTypeName);
    const [nodeTypes, edgeTypes] = await this.transformGrapTypeByDDL(graphTypeName);
    this.updateNodeTypeList(nodeTypes);
    this.updateEdgeTypeList(edgeTypes);
    this.originalNodeTypeList = cloneDeep(nodeTypes);
    this.originalEdgeTypeList = cloneDeep(edgeTypes);
  };

  get nodeTypeLabeMap() {
    const labelMap = new Map<string, string[]>();
    this.nodeTypeList.forEach((node) => {
      node.labels.forEach((label) => {
        if (!labelMap.has(label)) {
          labelMap.set(label, [node.name]);
        } else {
          labelMap.set(label, labelMap.get(label)!.concat([node.name]));
        }
      });
    });
    return labelMap;
  }

  get edgeTypeLabelMap() {
    const labelMap = new Map<string, string[]>();
    this.edgeTypeList.forEach((edge) => {
      edge.labels?.forEach((label) => {
        if (!labelMap.has(label)) {
          labelMap.set(label, [edge.name]);
        } else {
          labelMap.set(label, labelMap.get(label)!.concat([edge.name]));
        }
      });
    });
    return labelMap;
  }

  updateNodeTypeList = (nodeTypeList: INodeTypeItem[]) => {
    this.nodeTypeList.replace(nodeTypeList);
  };

  updateEdgeTypeList = (edgeTypeList: IEdgeTypeItem[]) => {
    this.edgeTypeList.replace(edgeTypeList);
  };

  updateGraphTypeName = (name: string) => {
    this.graphtypeName = name;
  };

  transformGrapTypeByDDL = async (graphType: string): Promise<[INodeTypeItem[], IEdgeTypeItem[]]> => {
    const gql = `CALL describe_graph_type("${graphType}") RETURN *`;
    const res = await execGql<GQLResult<DescGraphTypeResult>>(gql);
    if (res.code === 0) {
      const nodeTypes: INodeTypeItem[] = [];
      const edgeTypes: IEdgeTypeItem[] = [];
      (res.data?.tables || []).forEach((item: DescGraphTypeResult) => {
        const { labels, entity_type, type_name, type_pattern } = item;
        if (entity_type === GraphEntityType.Node) {
          nodeTypes.push(
            new INodeTypeItem({
              name: type_name,
              labels,
              properties: [],
            })
          );
        } else if (entity_type === GraphEntityType.Edge) {
          const multiEdgeKeyInfo = item['primary_key/multiedge_key'];
          const info = extractEdgeByEdgeTypeName(type_pattern!);
          if (info) {
            edgeTypes.push(
              new IEdgeTypeItem({
                name: type_name,
                srcNode: nodeTypes.find((node) => node.name === info.fromNodeName),
                dstNode: nodeTypes.find((node) => node.name === info.dstNodeName),
                direction: info.direction,
                labels,
                properties: [],
                multiEdgeKeyMode:
                  multiEdgeKeyInfo === 'Unique'
                    ? MultiEdgeKeyMode.None
                    : multiEdgeKeyInfo === 'Auto'
                      ? MultiEdgeKeyMode.Auto
                      : MultiEdgeKeyMode.Customize,
              })
            );
          }
        }
      });
      nodeTypes.forEach((node, index) => {
        node.style = this.#getInitNodePosition(index, nodeTypes.length);
      });

      const [updatedNodeTypes, updatedEdgeTypes] = await Promise.all([
        this.updateNodeTypeItemProperty(nodeTypes),
        this.updateEdgeTypeItemProperty(edgeTypes),
      ]);
      return [updatedNodeTypes, updatedEdgeTypes];
    }
    return [[], []];
  };

  transformGrapTypeBySketch = async (sketchId: number) => {
    const res = await getSketchById(sketchId);
    if (res.code === 0) {
      const sketchItem = res.data?.item;
      if (!sketchItem) return;
      const schemaData: { nodes: INodeTypeItem[]; edges: IEdgeTypeItem[] } = JSON.parse(sketchItem.schema);
      const nodeTypes: INodeTypeItem[] = schemaData.nodes.map((node) => new INodeTypeItem(node));
      const edgeTypes: IEdgeTypeItem[] = schemaData.edges.map((edge) => {
        const edgeItem = new IEdgeTypeItem(edge);
        edgeItem.srcNode = nodeTypes.find((node) => node.name === edgeItem.srcNode?.name)!;
        edgeItem.dstNode = nodeTypes.find((node) => node.name === edgeItem.dstNode?.name)!;
        return edgeItem;
      });
      this.updateGraphTypeName(sketchItem.name);
      this.updateNodeTypeList(nodeTypes);
      this.updateEdgeTypeList(edgeTypes);
    }
  };

  updateNodeTypeItemProperty = async (nodeTypes: INodeTypeItem[]): Promise<INodeTypeItem[]> => {
    const nodePropertyGql = [
      `LET gtn = "${this.graphtypeName}"`,
      `CALL describe_graph_type(gtn) YIELD entity_type, type_name filter where entity_type = "Node"`,
      `CALL describe_node_type(gtn, type_name)`,
      `RETURN *`,
    ].join('');
    const res = await execGql<GQLResult<DescNodeTypeResult>>(nodePropertyGql);
    if (res.code === 0) {
      const info = groupBy(res.data?.tables || [], (item: DescNodeTypeResult) => item.type_name);
      Object.keys(info).forEach((type_name) => {
        const nodeType = nodeTypes.find((node) => node.name === type_name);
        if (nodeType && info[type_name]) {
          nodeType.properties = ((info[type_name] || []) as unknown as DescNodeTypeResult[]).map((item) => {
            const { type, decimalPrecision, decimalScale, itemType, keyType, valueType, dimensionCount } =
              parsePropertyDataType(item.data_type);
            return new IProperty({
              name: item.property_name,
              type,
              decimalPrecision,
              decimalScale,
              isPrimaryKey: item.primary_key === 'Y',
              nullable: item.nullable,
              default: item.default,
              itemType,
              keyType,
              valueType,
              dimensionCount,
            });
          });
        }
      });
    }
    return nodeTypes;
  };

  updateEdgeTypeItemProperty = async (edgeTypes: IEdgeTypeItem[]): Promise<IEdgeTypeItem[]> => {
    const edgePropertyGql = [
      `LET gtn = "${this.graphtypeName}"`,
      `CALL describe_graph_type(gtn) YIELD entity_type, type_name filter where entity_type = "Edge"`,
      `CALL describe_edge_type(gtn, type_name)`,
      `RETURN *`,
    ].join('');
    const res = await execGql<GQLResult<DescEdgeTypeResult>>(edgePropertyGql);
    if (res.code === 0) {
      const info = groupBy(res.data?.tables || [], (item: DescEdgeTypeResult) => item.type_name);
      Object.keys(info).forEach((type_name) => {
        const edgeType = edgeTypes.find((edge) => edge.name === type_name);
        if (edgeType && info[type_name]) {
          edgeType.properties = ((info[type_name] || []) as DescEdgeTypeResult[]).map((item) => {
            const { type, decimalPrecision, decimalScale, itemType, keyType, valueType, dimensionCount } =
              parsePropertyDataType(item.data_type);
            return new IProperty({
              name: item.property_name,
              type,
              decimalPrecision,
              decimalScale,
              multiEdgeKey: item.multi_edge_key === 'Y',
              nullable: item.nullable,
              default: item.default,
              itemType,
              keyType,
              valueType,
              dimensionCount,
            });
          });
        }
      });
    }
    return edgeTypes;
  };

  addNodeType = (node: INodeTypeItem) => {
    const style = {
      ...this.#getInitNodePosition(this.nodeTypeList.length, this.nodeTypeList.length + 1),
      ...node.style,
    };
    node.style = style;
    this.nodeTypeList.push(node);
    this.nodeTypeList.replace(this.nodeTypeList); // force update
  };

  initReactions = () => {
    this.activeItemDisposer = reaction(
      () => this.activeItem,
      () => {
        if (this.activeItem?.type === VisualEditorType.Tag) {
          const item = this.nodeTypeList.find((node) => node.id === this.activeItem?.value.id);
          item?.updateValues(this.activeItem?.value as INodeTypeItem);
        }
        if (this.activeItem?.type === VisualEditorType.Edge) {
          const item = this.edgeTypeList.find((edge) => edge.id === this.activeItem?.value.id);
          item?.updateValues(this.activeItem?.value as IEdgeTypeItem);
        }
      }
    );
  };

  #getInitNodePosition = (index: number, total = 0): VisualInfo => {
    const midIndex = total / 2;
    const style = this.getNodeStyle(index);
    const x = this.containerWidth / 2 + (index - midIndex) * 150;
    const b = total > 2 ? (index % 2 === 0 ? 1 : -1) : 0;
    const y = this.containerHeight / 2 + b * 100;
    return { position: { x, y }, ...style };
  };

  /**
   * Get a node style by index, generating random colors
   * @param index - The index to get the style for (used for seed)
   * @returns An object with fill, strokeColor, and shadow properties
   */
  getNodeStyle = (index: number) => {
    const base = randomColor({
      luminosity: 'bright',
      seed: (index + 1) ** 2,
    });
    const fill = base;
    const strokeColor = base;
    const shadow = alpha(base, 0.25);

    return { fill, strokeColor, shadow };
  };

  updateNodeType = (id: string, node: INodeTypeItem) => {
    this.nodeTypeList.find((node) => node.id === id)?.updateValues(node);
  };

  setActiveItem = (info?: ActiveItemInfo) => {
    this.activeItem = info;
  };

  updateEdgeType = (id: string, edge: Omit<IEdgeTypeItem, 'id'>) => {
    this.edgeTypeList.find((edge) => edge.id === id)?.updateValues(edge);
  };

  addEdgeType = (edge: IEdgeTypeItem) => {
    this.edgeTypeList.push(edge);
    this.edgeTypeList.replace(this.edgeTypeList); // force update
  };

  deleteNodeType = (item: INodeTypeItem) => {
    const edges = this.edgeTypeList.filter((edge) => edge.srcNode.id === item.id || edge.dstNode.id === item.id);
    edges.forEach((edge) => {
      this.edgeTypeList.remove(edge);
    });
    this.nodeTypeList.replace(this.nodeTypeList.filter((node) => node.id !== item.id));
  };

  deleteEdgeType = (item: IEdgeTypeItem) => {
    this.edgeTypeList.replace(this.edgeTypeList.filter((edge) => edge.id !== item.id));
  };

  disposeReaction = () => {
    this.reactionDisposer?.();
    this.reactionDisposer = undefined;
    this.activeItemDisposer?.();
    this.activeItemDisposer = undefined;
  };
}

export default SchemaStore;
