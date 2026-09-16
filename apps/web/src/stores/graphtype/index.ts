import { action, makeAutoObservable, observable } from 'mobx';
import type { RootStore } from '..';
import SchemaStore from './schema';
import { execGql, getSketchList } from '@studio/services';
import { GraphTypeBuildMode, SketchListItem } from '@studio/interfaces';
import { GQLResult } from '@vesoft-inc/utils';

export interface IGraphTypeItem {
  name: string;
  graphList: string[];
}

class GraphTypeStore {
  rootStore?: RootStore;
  loading = false;
  schemaStore?: SchemaStore;
  graphTypeList = observable.array<IGraphTypeItem>([]);
  sketchListItem: SketchListItem;
  mode: GraphTypeBuildMode = GraphTypeBuildMode.Create;

  constructor(rootStore?: RootStore) {
    this.sketchListItem = { items: [], total: 0, page: 1, pageSize: 10 };
    makeAutoObservable(this, {
      rootStore: observable.ref,
      setLoading: action,
      schemaStore: observable.ref,
    });
    this.rootStore = rootStore;
  }

  updateMode = (mode: GraphTypeBuildMode) => {
    this.mode = mode;
  };

  getGraphTypeList = async () => {
    const gql = `
    call show_graph_types() yield graph_type_name as gt
    optional call show_graphs(gt) 
    return gt as name,collect(graph_name) as graphList 
    group by name
    `;
    const res = await execGql<GQLResult<{ graphList: string[]; name: string }>>(gql);
    const tableData = res.data?.tables || [];
    this.updateGraphTypeList(tableData);
  };

  updateGraphTypeList = (graphTypeList: IGraphTypeItem[]) => {
    this.graphTypeList.replace(graphTypeList);
  };

  initSchemaStore = () => {
    if (this.schemaStore) return;
    this.schemaStore = new SchemaStore(this.rootStore);
  };

  destroySchemaStore = () => {
    this.schemaStore?.disposeReaction();
    this.schemaStore = undefined;
  };

  setLoading = (loading: boolean) => {
    this.loading = loading;
  };

  updateSketchListItem = (sketchListItem: SketchListItem) => {
    this.sketchListItem = sketchListItem;
  };

  fetchSketchList = async (keyword?: string, page?: number, pageSize?: number) => {
    const res = await getSketchList({ keyword, page, pageSize });
    if (res.code === 0) {
      this.updateSketchListItem(res.data!);
    }
  };
}

export default GraphTypeStore;
