import { makeAutoObservable, observable } from 'mobx';
import { GraphEntityType } from '@vesoft-inc/utils';
import type { DescGraphTypeResult, GQLResult } from '@vesoft-inc/utils';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

import { RawEntityType } from '../types/gql';
import type { GraphDataTable, GraphEdgeValue, GraphNodeValue } from '../types/gql';
import {
  buildDeleteGql,
  buildEntityMeta,
  buildInsertEdgeGql,
  buildInsertNodeGql,
  buildReadBackEdgeGql,
  buildReadBackNodeGql,
  buildSetPropertiesGql,
  getEligibleEdgeTypeOptions,
  getEditableProperties,
  getInitialFormValues,
  toFormValue,
  validateEntityValues,
  type EdgeTypeOption,
  type EntityMeta,
  type EntityRef,
  type EntityValidationErrors,
} from '../utils/base/dml';
import type { GraphStore } from './graph';
import type { GraphWorkspaceStore } from './workspace';

export type GraphEditNodeModal = {
  kind: 'node';
  mode: 'add' | 'edit';
  typeName: string;
  /** Present when editing an existing node. */
  entity?: NodeObject;
};

export type GraphEditEdgeModal = {
  kind: 'edge';
  mode: 'add' | 'edit';
  typeName: string;
  /** Endpoints exactly as the user selected them: first selected = source. */
  source: NodeObject;
  target: NodeObject;
  /** Present when editing an existing edge. */
  entity?: LinkObject;
};

export type GraphEditDeleteModal = {
  kind: 'delete';
  nodes: NodeObject[];
  links: LinkObject[];
};

export type GraphEditModal = GraphEditNodeModal | GraphEditEdgeModal | GraphEditDeleteModal;

export type GraphEditSubmitResult = { ok: boolean; errors?: EntityValidationErrors };

const entityTypeOf = (entity: NodeObject | LinkObject): GraphEntityType =>
  entity.data.type === RawEntityType.EDGE ? GraphEntityType.Edge : GraphEntityType.Node;

const nodeTypeNameOf = (node: NodeObject) => (node.data.value as GraphNodeValue).type;

const edgeValueOf = (link: LinkObject) => link.data.value as GraphEdgeValue;

/**
 * Canvas edit mode: schema driven add / update / delete of nodes and edges, persisted
 * through v5 GQL DML (statement builders live in `graph/utils/base/dml`).
 */
export class GraphEditStore {
  graph: GraphStore;
  explorerStore: GraphWorkspaceStore;
  editMode = false;
  submitting = false;
  modal?: GraphEditModal;

  constructor(graph: GraphStore, explorerStore: GraphWorkspaceStore) {
    this.graph = graph;
    this.explorerStore = explorerStore;
    makeAutoObservable(this, {
      graph: false,
      explorerStore: false,
      modal: observable.ref,
    });
  }

  get message() {
    return this.explorerStore.stores?.modalStore?.message;
  }

  get graphName() {
    return this.explorerStore.currentSnapshot?.graph;
  }

  /** Edit mode needs both a target graph and its schema. */
  get canEdit() {
    return !!this.graphName && !!this.explorerStore.graphTypeDetails?.length;
  }

  get nodeTypes(): DescGraphTypeResult[] {
    return this.explorerStore.curNodeTypes;
  }

  get edgeTypes(): DescGraphTypeResult[] {
    return this.explorerStore.curEdgeTypes;
  }

  /** Node types with an auto generated identity cannot be read back reliably after insert. */
  get addableNodeTypes() {
    return this.nodeTypes.filter((item) => item['primary_key/multiedge_key'] !== 'Auto');
  }

  /** First two selected nodes, in selection order. */
  get selectedEndpoints(): { source: NodeObject; target: NodeObject } | undefined {
    const selected = Array.from(this.graph.nodesSelected);
    if (selected.length !== 2) return undefined;
    return { source: selected[0], target: selected[1] };
  }

  getEligibleEdgeTypes(): EdgeTypeOption[] {
    const modal = this.modal;
    const endpoints = modal?.kind === 'edge' ? { source: modal.source, target: modal.target } : this.selectedEndpoints;
    const graph = this.graphName;
    if (!endpoints || !graph) return [];
    return getEligibleEdgeTypeOptions({
      graph,
      edgeTypes: this.edgeTypes,
      sourceTypeName: nodeTypeNameOf(endpoints.source),
      targetTypeName: nodeTypeNameOf(endpoints.target),
    });
  }

  get modalEntityMeta(): EntityMeta | undefined {
    const modal = this.modal;
    if (!modal || modal.kind === 'delete') return undefined;
    return this.getEntityMeta(modal.typeName, modal.kind === 'node' ? GraphEntityType.Node : GraphEntityType.Edge);
  }

  get modalInitialValues(): Record<string, string> {
    const modal = this.modal;
    const meta = this.modalEntityMeta;
    if (!modal || !meta || modal.kind === 'delete') return {};
    if (modal.mode === 'edit' && modal.entity) {
      return getInitialFormValues(meta, modal.entity.data.value.properties, 'edit');
    }
    return getInitialFormValues(meta);
  }

  getEntityMeta(typeName: string, entityType: GraphEntityType): EntityMeta | undefined {
    const graph = this.graphName;
    if (!graph) return undefined;
    const detail = this.explorerStore.graphTypeDetails?.find(
      (item) => item.type_name === typeName && item.entity_type === entityType
    );
    return detail ? buildEntityMeta(detail, graph) : undefined;
  }

  setEditMode = (next: boolean) => {
    if (next && !this.canEdit) {
      this.message?.warning(this.explorerStore.translate('editUnavailable', { ns: 'explorer' }));
      return;
    }
    this.editMode = next;
    if (!next) {
      this.modal = undefined;
    }
  };

  toggleEditMode = () => this.setEditMode(!this.editMode);

  updateModalTypeName = (typeName: string) => {
    if (!this.modal || this.modal.kind === 'delete') return;
    this.modal = { ...this.modal, typeName };
  };

  openAddNode = (typeName?: string) => {
    const addable = this.addableNodeTypes;
    if (!addable.length) {
      this.message?.warning(this.explorerStore.translate('noAddableNodeType', { ns: 'explorer' }));
      return;
    }
    const target = addable.find((item) => item.type_name === typeName) ?? addable[0];
    this.modal = { kind: 'node', mode: 'add', typeName: target.type_name };
  };

  openAddEdge = () => {
    const endpoints = this.selectedEndpoints;
    if (!endpoints) {
      this.message?.warning(this.explorerStore.translate('selectSourceTargetFirst', { ns: 'explorer' }));
      return;
    }
    const options = this.getEligibleEdgeTypes();
    if (!options.length) {
      this.message?.warning(this.explorerStore.translate('noEligibleEdgeType', { ns: 'explorer' }));
      return;
    }
    this.modal = {
      kind: 'edge',
      mode: 'add',
      typeName: options[0].meta.type_name,
      source: endpoints.source,
      target: endpoints.target,
    };
  };

  openEditEntity = (entity: NodeObject | LinkObject) => {
    const entityType = entityTypeOf(entity);
    const typeName =
      entityType === GraphEntityType.Node
        ? nodeTypeNameOf(entity as NodeObject)
        : edgeValueOf(entity as LinkObject).type;
    const meta = this.getEntityMeta(typeName, entityType);
    // Primary key / multi-edge key properties are the element identity and cannot be updated.
    if (meta && !getEditableProperties(meta).length) {
      this.message?.warning(this.explorerStore.translate('noEditableProperty', { ns: 'explorer' }));
      return;
    }
    if (entityType === GraphEntityType.Node) {
      const node = entity as NodeObject;
      this.modal = { kind: 'node', mode: 'edit', typeName, entity: node };
      return;
    }
    const link = entity as LinkObject;
    const source = link.source as NodeObject;
    const target = link.target as NodeObject;
    if (!source?.data || !target?.data) return;
    this.modal = {
      kind: 'edge',
      mode: 'edit',
      typeName,
      source,
      target,
      entity: link,
    };
  };

  openDeleteConfirm = (entities?: (NodeObject | LinkObject)[]) => {
    const nodes = (entities ?? Array.from(this.graph.nodesSelected)).filter(
      (item) => entityTypeOf(item) === GraphEntityType.Node
    ) as NodeObject[];
    const links = (entities ?? Array.from(this.graph.linksSelected)).filter(
      (item) => entityTypeOf(item) === GraphEntityType.Edge
    ) as LinkObject[];
    if (!nodes.length && !links.length) return;
    this.modal = { kind: 'delete', nodes, links };
  };

  closeModal = () => {
    this.modal = undefined;
  };

  submit = async (values: Record<string, string>): Promise<GraphEditSubmitResult> => {
    const modal = this.modal;
    if (!modal || modal.kind === 'delete') return { ok: false };
    const meta = this.modalEntityMeta;
    if (!meta) return { ok: false };

    const errors = validateEntityValues(meta, values, modal.mode);
    if (Object.keys(errors).length) return { ok: false, errors };

    this.submitting = true;
    try {
      if (modal.kind === 'node') {
        return modal.mode === 'add'
          ? this.insertNode(meta, values)
          : this.updateNode(meta, modal.entity as NodeObject, values);
      }
      return modal.mode === 'add' ? this.insertEdge(meta, modal, values) : this.updateEdge(meta, modal, values);
    } finally {
      this.submitting = false;
    }
  };

  confirmDelete = async () => {
    const modal = this.modal;
    if (!modal || modal.kind !== 'delete') return;
    this.submitting = true;
    try {
      const deletedNodes: NodeObject[] = [];
      const deletedLinks: LinkObject[] = [];
      let failed = 0;

      // An edge between two nodes that are deleted as well is removed by DETACH DELETE,
      // so it must not be deleted twice.
      const nodesToDelete = modal.nodes;
      const nodeSet = new Set(nodesToDelete);
      const linksToDelete = modal.links.filter((link) => {
        const source = link.source as NodeObject;
        const target = link.target as NodeObject;
        return !nodeSet.has(source) && !nodeSet.has(target);
      });

      for (const link of linksToDelete) {
        const ref = this.buildEdgeRef(link);
        const meta = this.getEntityMeta(edgeValueOf(link).type, GraphEntityType.Edge);
        if (!ref || !meta) {
          failed++;
          continue;
        }
        const ok = await this.runWrite(buildDeleteGql({ meta, ref }));
        ok ? deletedLinks.push(link) : failed++;
      }

      for (const node of nodesToDelete) {
        const meta = this.getEntityMeta(nodeTypeNameOf(node), GraphEntityType.Node);
        if (!meta) {
          failed++;
          continue;
        }
        const ref: EntityRef = { entityType: GraphEntityType.Node, elementId: node.id! };
        const ok = await this.runWrite(buildDeleteGql({ meta, ref }));
        ok ? deletedNodes.push(node) : failed++;
      }

      if (deletedNodes.length || deletedLinks.length) {
        this.graph.removeEntities({ nodes: deletedNodes, links: deletedLinks });
      }
      if (failed) {
        this.message?.error(this.explorerStore.translate('deletePartialFailed', { ns: 'explorer', count: failed }));
        return;
      }
      this.message?.success(this.explorerStore.translate('deleteSuccess', { ns: 'explorer' }));
      this.closeModal();
    } finally {
      this.submitting = false;
    }
  };

  private insertNode = async (meta: EntityMeta, values: Record<string, string>): Promise<GraphEditSubmitResult> => {
    const ok = await this.runWrite(buildInsertNodeGql({ meta, values }));
    if (!ok) return { ok: false };

    const readBackGql = buildReadBackNodeGql({ meta, values });
    const result = readBackGql ? await this.readGraph(readBackGql) : undefined;
    if (result?.vertexes.length) {
      this.graph.upsertNodesAndEdges({
        vertexes: result.vertexes,
        edges: [],
        shouldNodeSelected: true,
        shouldPushHistory: false,
      });
      this.graph.moveNodesToViewportCenter(result.vertexes);
    } else {
      this.message?.warning(this.explorerStore.translate('elementNotFound', { ns: 'explorer' }));
    }
    this.message?.success(this.explorerStore.translate('addSuccess', { ns: 'explorer' }));
    this.closeModal();
    return { ok: true };
  };

  private insertEdge = async (
    meta: EntityMeta,
    modal: GraphEditEdgeModal,
    values: Record<string, string>
  ): Promise<GraphEditSubmitResult> => {
    const option = this.getEligibleEdgeTypes().find((item) => item.meta.type_name === modal.typeName);
    // Directed edge types define the real source/target; swap when the user picked the reverse order.
    const [sourceNode, targetNode] = option?.reversed ? [modal.target, modal.source] : [modal.source, modal.target];
    const src = { id: sourceNode.id!, typeName: nodeTypeNameOf(sourceNode) };
    const dst = { id: targetNode.id!, typeName: nodeTypeNameOf(targetNode) };
    const directed = option?.directed ?? true;

    const ok = await this.runWrite(buildInsertEdgeGql({ meta, src, dst, values, directed }));
    if (!ok) return { ok: false };

    const readBackGql = buildReadBackEdgeGql({ meta, src, dst, values, directed });
    const result = await this.readGraph(readBackGql);
    if (result?.edges.length) {
      this.graph.upsertNodesAndEdges({
        vertexes: result.vertexes,
        edges: result.edges,
        shouldLinkSelected: true,
        shouldPushHistory: false,
      });
    } else {
      this.message?.warning(this.explorerStore.translate('elementNotFound', { ns: 'explorer' }));
    }
    this.message?.success(this.explorerStore.translate('addSuccess', { ns: 'explorer' }));
    this.closeModal();
    return { ok: true };
  };

  private updateNode = async (
    meta: EntityMeta,
    node: NodeObject,
    values: Record<string, string>
  ): Promise<GraphEditSubmitResult> => {
    const changed = this.pickChangedValues(meta, node.data.value.properties, values);
    if (!Object.keys(changed).length) {
      this.closeModal();
      return { ok: true };
    }
    const ref: EntityRef = { entityType: GraphEntityType.Node, elementId: node.id! };
    const ok = await this.runWrite(buildSetPropertiesGql({ meta, ref, values: changed }));
    if (!ok) return { ok: false };
    this.graph.applyEntityProperties(node, changed);
    this.message?.success(this.explorerStore.translate('updateSuccess', { ns: 'explorer' }));
    this.closeModal();
    return { ok: true };
  };

  private updateEdge = async (
    meta: EntityMeta,
    modal: GraphEditEdgeModal,
    values: Record<string, string>
  ): Promise<GraphEditSubmitResult> => {
    const link = modal.entity as LinkObject;
    const ref = this.buildEdgeRef(link);
    if (!ref) return { ok: false };
    const changed = this.pickChangedValues(meta, link.data.value.properties, values);
    if (!Object.keys(changed).length) {
      this.closeModal();
      return { ok: true };
    }
    const ok = await this.runWrite(buildSetPropertiesGql({ meta, ref, values: changed }));
    if (!ok) return { ok: false };
    this.graph.applyEntityProperties(link, changed);
    this.message?.success(this.explorerStore.translate('updateSuccess', { ns: 'explorer' }));
    this.closeModal();
    return { ok: true };
  };

  private buildEdgeRef = (link: LinkObject): EntityRef | undefined => {
    const source = link.source as NodeObject;
    const target = link.target as NodeObject;
    if (!source?.data || !target?.data) return undefined;
    const value = edgeValueOf(link);
    return {
      entityType: GraphEntityType.Edge,
      srcId: source.id!,
      dstId: target.id!,
      srcTypeName: nodeTypeNameOf(source),
      dstTypeName: nodeTypeNameOf(target),
      rank: value.rank,
      directed: value.isDirected !== false,
    };
  };

  /** Only send properties whose form value actually differs from the graph value. */
  private pickChangedValues = (meta: EntityMeta, current: Record<string, unknown>, values: Record<string, string>) => {
    const changed: Record<string, string> = {};
    meta.properties.forEach((property) => {
      if (property.isKey) return;
      const nextValue = values[property.property_name];
      if (nextValue === undefined) return;
      if (nextValue.trim() !== toFormValue(current[property.property_name]).trim()) {
        changed[property.property_name] = nextValue;
      }
    });
    return changed;
  };

  private runWrite = async (gql: string) => {
    const res = await this.explorerStore.execGqlBySerial<GQLResult<GraphDataTable>>(gql, { errTip: false });
    if (!res || res.code !== 0) {
      this.message?.error(res?.message || this.explorerStore.translate('writeFailed', { ns: 'explorer' }));
      return false;
    }
    const stats = res.data?.summary?.queryStats;
    if (stats && (stats.numAffectedNodes || 0) + (stats.numAffectedEdges || 0) === 0) {
      // MATCH without a hit is a silent no-op on the server, so treat it as a failure.
      this.message?.error(this.explorerStore.translate('elementNotFound', { ns: 'explorer' }));
      return false;
    }
    return true;
  };

  private readGraph = async (gql: string) => {
    const res = await this.explorerStore.execGqlBySerial<GQLResult<GraphDataTable>>(gql, { errTip: false });
    if (!res || res.code !== 0) {
      if (res?.code)
        this.message?.error(res?.message || this.explorerStore.translate('writeFailed', { ns: 'explorer' }));
      return undefined;
    }
    return this.graph.parseSubGraph(res.data?.tables || [], this.explorerStore.nodeTypePrimaryKeysMap);
  };
}

export default GraphEditStore;
