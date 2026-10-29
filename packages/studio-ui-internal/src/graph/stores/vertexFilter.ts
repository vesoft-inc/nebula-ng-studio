import { makeAutoObservable, observable, ObservableSet } from 'mobx';
import type { GraphStore } from './graph';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

import { VertexFilterDisplay } from '../../contracts/filter';
export { VertexFilterDisplay } from '../../contracts/filter';
class VertexFilterStore {
  graph: GraphStore;
  filterType: VertexFilterDisplay = VertexFilterDisplay.Grayscale;

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

  get filteredInfoSize() {
    const filterType = this.filterType;
    return (
      this.entityIdsFilterInfo.get(filterType)!.size +
      this.nodeTypeFilterInfo.get(filterType)!.size +
      this.edgeTypeFilterInfo.get(filterType)!.size
    );
  }

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
    makeAutoObservable(this, {});
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

  // 过滤具体的点
  handleGraphFilter = () => {
    const validFilters = this.graph.filterList.filter((item) => item.enable);
    const entityIdsSet = new Set<string>();
    const nodesSelected: NodeObject[] = [];
    const unselectLinks: LinkObject[] = [];
    if (!validFilters.length) {
      this.updateEntityIdsFilterSet(entityIdsSet);
      this.updateEntityIdsGreyScaledSet(entityIdsSet);
      return;
    }

    const shouldAddToEntityIdsSet = (entity: NodeObject | LinkObject) => {
      const result = validFilters.some((filter) => {
        if (!filter.isSameType(entity)) {
          return false;
        }
        if (filter.isMeetCondition(entity)) {
          return false;
        }
        return true;
      });
      return result;
    };

    this.graph.nodes.forEach((vertex) => {
      if (shouldAddToEntityIdsSet(vertex)) {
        entityIdsSet.add(vertex.id!);
      }
    });

    this.graph.links.forEach((link) => {
      if (shouldAddToEntityIdsSet(link)) {
        entityIdsSet.add(link.id!);
      }
    });
    if (this.filterType === VertexFilterDisplay.Hide) {
      this.updateEntityIdsFilterSet(entityIdsSet);
      this.updateEntityIdsGreyScaledSet(new Set());
    } else if (this.filterType === VertexFilterDisplay.Grayscale) {
      this.updateEntityIdsGreyScaledSet(entityIdsSet);
      this.updateEntityIdsFilterSet(new Set());
    }
    this.graph.replaceNodeSelected(nodesSelected);
    this.graph.unselectLinks(unselectLinks);
  };
}

export default VertexFilterStore;
