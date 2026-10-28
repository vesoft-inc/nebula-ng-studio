import { computed, makeAutoObservable, observable, runInAction } from 'mobx';
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
  NodeLayoutMap,
  VisualInfo,
} from '../schema/types';
import type { SchemaEditorServices } from './services';
import { VisualEditorType } from '../shared/constants';
import { extractEdgeByEdgeTypeName } from '../shared/utilities';
import randomColor from 'randomcolor';
import { alpha } from '@mui/material';

export type ActiveItemInfo =
  | { type: VisualEditorType.Edge; value: IEdgeTypeItem }
  | { type: VisualEditorType.Tag; value: INodeTypeItem };

type CanvasSync = {
  updateNodes: (nodeTypeList: INodeTypeItem[], savedLayout: NodeLayoutMap | null) => void;
  updateEdges: (edgeTypeList: IEdgeTypeItem[]) => void;
};

class SchemaStore {
  private loadVersion = 0;
  private abort = new AbortController();
  canvas?: CanvasSync;
  /** Schema edits request a sync; VisualBuilder performs it after rendering is allowed. */
  canvasRevision = 0;
  activeItem?: ActiveItemInfo;
  originalNodeTypeList: INodeTypeItem[] = [];
  originalEdgeTypeList: IEdgeTypeItem[] = [];
  nodeTypeList = observable.array<INodeTypeItem>([], { deep: false });
  edgeTypeList = observable.array<IEdgeTypeItem>([], { deep: false });

  /** Node type name -> canvas position, restored from the server when the graph type is opened. */
  savedLayout: NodeLayoutMap | null = null;

  // Container dimensions for initial position calculations
  containerWidth = 800;
  containerHeight = 600;

  graphtypeName?: string;

  constructor(public readonly services: SchemaEditorServices) {
    makeAutoObservable<this, 'abort'>(this, {
      activeItem: observable.ref,
      services: false,
      abort: false,
      canvas: false,
      nodeTypeLabeMap: computed,
      edgeTypeLabelMap: computed,
    });
  }

  attachCanvas = (canvas: CanvasSync) => {
    this.canvas = canvas;
  };

  syncCanvas = () => {
    this.canvas?.updateEdges(this.edgeTypeList.slice());
    this.canvas?.updateNodes(this.nodeTypeList.slice(), this.savedLayout);
  };

  // Transform data from DDL to editor
  transformGraphTypeToEditorFromDDL = async (graphTypeName: string) => {
    this.updateGraphTypeName(graphTypeName);

    const version = ++this.loadVersion;

    // Load the saved layout alongside the DDL so it is already in place when
    // VisualBuilder synchronizes the loaded schema to the canvas. A missing or
    // unreadable layout must never prevent the editor from opening.
    const [[nodeTypes, edgeTypes], savedLayout] = await Promise.all([
      this.transformGrapTypeByDDL(graphTypeName),
      (this.services.layouts?.read(graphTypeName) ?? Promise.resolve(null)).catch((error) => {
        console.warn('[schema-layout] failed to restore layout', error);
        return null;
      }),
    ]);

    if (version !== this.loadVersion || this.abort.signal.aborted) return;
    runInAction(() => {
      this.savedLayout = savedLayout;
      this.updateNodeTypeList(nodeTypes);
      this.updateEdgeTypeList(edgeTypes);
      this.originalNodeTypeList = cloneDeep(nodeTypes);
      this.originalEdgeTypeList = cloneDeep(edgeTypes);
    });
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
    this.canvasRevision += 1;
  };

  updateEdgeTypeList = (edgeTypeList: IEdgeTypeItem[]) => {
    this.edgeTypeList.replace(edgeTypeList);
    this.canvasRevision += 1;
  };

  updateGraphTypeName = (name: string) => {
    this.graphtypeName = name;
  };

  transformGrapTypeByDDL = async (graphType: string): Promise<[INodeTypeItem[], IEdgeTypeItem[]]> => {
    const gql = `CALL describe_graph_type("${graphType}") RETURN *`;
    const res = await this.services.execute<GQLResult<DescGraphTypeResult>>(gql, { signal: this.abort.signal });
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
        this.updateNodeTypeItemProperty(nodeTypes, graphType),
        this.updateEdgeTypeItemProperty(edgeTypes, graphType),
      ]);
      return [updatedNodeTypes, updatedEdgeTypes];
    }
    return [[], []];
  };

  transformGrapTypeBySketch = async (sketchId: number) => {
    if (!this.services.sketches) return;
    const version = ++this.loadVersion;
    const res = await this.services.sketches.read(sketchId);
    if (version !== this.loadVersion || this.abort.signal.aborted) return;
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

  updateNodeTypeItemProperty = async (
    nodeTypes: INodeTypeItem[],
    graphTypeName = this.graphtypeName
  ): Promise<INodeTypeItem[]> => {
    const nodePropertyGql = [
      `LET gtn = "${graphTypeName}"`,
      `CALL describe_graph_type(gtn) YIELD entity_type, type_name filter where entity_type = "Node"`,
      `CALL describe_node_type(gtn, type_name)`,
      `RETURN *`,
    ].join('');
    const res = await this.services.execute<GQLResult<DescNodeTypeResult>>(nodePropertyGql, {
      signal: this.abort.signal,
    });
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

  updateEdgeTypeItemProperty = async (
    edgeTypes: IEdgeTypeItem[],
    graphTypeName = this.graphtypeName
  ): Promise<IEdgeTypeItem[]> => {
    const edgePropertyGql = [
      `LET gtn = "${graphTypeName}"`,
      `CALL describe_graph_type(gtn) YIELD entity_type, type_name filter where entity_type = "Edge"`,
      `CALL describe_edge_type(gtn, type_name)`,
      `RETURN *`,
    ].join('');
    const res = await this.services.execute<GQLResult<DescEdgeTypeResult>>(edgePropertyGql, {
      signal: this.abort.signal,
    });
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
    this.canvasRevision += 1;
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

  commitNodeChanges = (id: string, node: INodeTypeItem) => {
    const current = this.nodeTypeList.find((item) => item.id === id);
    current?.updateValues(node);
    if (current) this.canvasRevision += 1;
  };

  /** Selection does not commit an edit. Forms call an explicit commit method. */
  selectItem = (info?: ActiveItemInfo) => {
    this.activeItem = info;
  };

  commitEdgeChanges = (id: string, edge: Omit<IEdgeTypeItem, 'id'>) => {
    const current = this.edgeTypeList.find((item) => item.id === id);
    current?.updateValues(edge);
    if (current) this.canvasRevision += 1;
  };

  /** @deprecated Use selectItem and commitNodeChanges/commitEdgeChanges separately. */
  setActiveItem = (info?: ActiveItemInfo) => {
    const changed = this.activeItem !== info;
    this.selectItem(info);
    if (!changed || !info) return;
    if (info.type === VisualEditorType.Tag) this.commitNodeChanges(info.value.id, info.value);
    else this.commitEdgeChanges(info.value.id, info.value);
  };

  /** Compatibility names for existing controller consumers. */
  updateNodeType = (id: string, node: INodeTypeItem) => this.commitNodeChanges(id, node);
  updateEdgeType = (id: string, edge: Omit<IEdgeTypeItem, 'id'>) => this.commitEdgeChanges(id, edge);

  addEdgeType = (edge: IEdgeTypeItem) => {
    this.edgeTypeList.push(edge);
    this.edgeTypeList.replace(this.edgeTypeList); // force update
    this.canvasRevision += 1;
  };

  deleteNodeType = (item: INodeTypeItem) => {
    const edges = this.edgeTypeList.filter((edge) => edge.srcNode.id === item.id || edge.dstNode.id === item.id);
    edges.forEach((edge) => {
      this.edgeTypeList.remove(edge);
    });
    this.nodeTypeList.replace(this.nodeTypeList.filter((node) => node.id !== item.id));
    this.canvasRevision += 1;
  };

  deleteEdgeType = (item: IEdgeTypeItem) => {
    this.edgeTypeList.replace(this.edgeTypeList.filter((edge) => edge.id !== item.id));
    this.canvasRevision += 1;
  };

  dispose = () => {
    this.loadVersion += 1;
    this.abort.abort();
  };

  /** @deprecated Kept for callers using the old lifecycle name. */
  disposeReaction = () => this.dispose();
}

export default SchemaStore;
