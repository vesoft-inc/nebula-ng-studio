import { makeAutoObservable, observable, ObservableSet } from 'mobx';
import type { GraphStore } from './graph';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

import { VertexFilterDisplay } from '../../contracts/filter';
export { VertexFilterDisplay } from '../../contracts/filter';
class VertexFilterStore {
  graph: GraphStore;
  filterType: VertexFilterDisplay = VertexFilterDisplay.Grayscale;
  private ruleDimmedIds = new Set<string>();

  entityIdsFilterInfo = observable.map<VertexFilterDisplay, ObservableSet<string>>(
    new Map([
      [VertexFilterDisplay.Hide, observable.set<string>([])],
      [VertexFilterDisplay.Grayscale, observable.set<string>([])],
    ])
  );

  // 根据一个类型进行过滤
  nodeTypeFilterInfo = observable.map<VertexFilterDisplay, ObservableSet<string>>(
    new Map([
      [VertexFilterDisplay.Hide, observable.set<string>([])],
      [VertexFilterDisplay.Grayscale, observable.set<string>([])],
    ])
  );

  edgeTypeFilterInfo = observable.map<VertexFilterDisplay, ObservableSet<string>>(
    new Map([
      [VertexFilterDisplay.Hide, observable.set<string>([])],
      [VertexFilterDisplay.Grayscale, observable.set<string>([])],
    ])
  );

  get entityIdsHideSet() {
    return this.entityIdsFilterInfo.get(VertexFilterDisplay.Hide)!;
  }

  get entityIdsGreyScaledSet() {
    return this.entityIdsFilterInfo.get(VertexFilterDisplay.Grayscale)!;
  }

  get nodeTypeHideSet() {
    return this.nodeTypeFilterInfo.get(VertexFilterDisplay.Hide)!;
  }

  get nodeTypeGreyScaledSet() {
    return this.nodeTypeFilterInfo.get(VertexFilterDisplay.Grayscale)!;
  }

  get edgeTypeHideSet() {
    return this.edgeTypeFilterInfo.get(VertexFilterDisplay.Hide)!;
  }

  get edgeTypeGreyScaledSet() {
    return this.edgeTypeFilterInfo.get(VertexFilterDisplay.Grayscale)!;
  }

  constructor(graphStore: GraphStore) {
    makeAutoObservable<VertexFilterStore, 'ruleDimmedIds'>(this, { ruleDimmedIds: false });
    this.graph = graphStore;
  }

  setFilterType = (type: VertexFilterDisplay) => {
    if (type === this.filterType) return;
    this.filterType = type;
    this.graph.updateShouldBlockRouter(true);
  };

  nodeTypeFilterAction = (nodeType: string, action: 'add' | 'delete') => {
    this.nodeTypeHideSet[action](nodeType);
  };

  edgeTypeFilterAction = (edgeType: string, action: 'add' | 'delete') => {
    this.edgeTypeHideSet[action](edgeType);
  };

  nodeTypeGreyScaleAction = (nodeType: string, action: 'add' | 'delete') => {
    this.nodeTypeGreyScaledSet[action](nodeType);
  };

  edgeTypeGreyScaleAction = (edgeType: string, action: 'add' | 'delete') => {
    this.edgeTypeGreyScaledSet[action](edgeType);
  };

  updateEntityIdsFilterSet = (entityIds: Set<string>) => {
    this.entityIdsHideSet.replace(entityIds);
  };

  updateEntityIdsGreyScaledSet = (entityIds: Set<string>) => {
    this.entityIdsGreyScaledSet.replace(entityIds);
  };

  handleGraphFilter = ({ dataChanged = false } = {}) => {
    const validFilters = this.graph.filterList.filter((item) => item.enable);
    if (dataChanged && validFilters.length === 0) return;

    const excluded = new Set<string>();
    if (validFilters.length > 0) {
      const collect = (entity: NodeObject | LinkObject) => {
        if (validFilters.some((filter) => filter.isSameType(entity) && !filter.isMeetCondition(entity))) {
          excluded.add(entity.id!);
        }
      };
      this.graph.nodes.forEach(collect);
      this.graph.links.forEach(collect);
    }

    // Data refreshes leave nodes dismissed through the context menu alone.
    const manuallyDimmed = dataChanged
      ? this.entityIdsGreyScaledSet.toJSON().filter((id) => !this.ruleDimmedIds.has(id))
      : [];
    const hide = this.filterType === VertexFilterDisplay.Hide;
    this.ruleDimmedIds = hide ? new Set() : excluded;
    this.updateEntityIdsFilterSet(hide ? excluded : new Set());
    this.updateEntityIdsGreyScaledSet(new Set([...manuallyDimmed, ...this.ruleDimmedIds]));
    if (!dataChanged && validFilters.length > 0) this.graph.clearNodesSelected();
  };
}

export default VertexFilterStore;
