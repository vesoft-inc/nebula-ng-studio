import { action, makeAutoObservable, observable } from 'mobx';
import SchemaStore from './schema';
import { execGql, getSketchList } from '@studio/services';
import { GraphTypeBuildMode, SketchListItem } from '@studio/interfaces';
import { GQLResult } from '@vesoft-inc/utils';
import { commonStore, schemaStore as sessionSchemaStore } from '../session';
import { CanvasStore } from '@studio/pages/SchemaManager/GraphTypeBuilder/VisualBuilder/store';

export interface IGraphTypeItem {
  name: string;
  graphList: string[];
}

class GraphTypeStore {
  loading = false;
  schemaStore?: SchemaStore;
  canvasStore?: CanvasStore;
  graphTypeList = observable.array<IGraphTypeItem>([]);
  sketchListItem: SketchListItem;
  mode: GraphTypeBuildMode = GraphTypeBuildMode.Create;

  constructor() {
    this.sketchListItem = { items: [], total: 0, page: 1, pageSize: 10 };
    makeAutoObservable(this, {
      setLoading: action,
      schemaStore: observable.ref,
      canvasStore: observable.ref,
    });
  }

  updateMode = (mode: GraphTypeBuildMode) => {
    this.mode = mode;
    this.canvasStore?.setReadonly(mode === GraphTypeBuildMode.Readonly);
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
    const editor = new SchemaStore();
    const canvas = new CanvasStore();
    editor.attachSession({ commonStore, schemaStore: sessionSchemaStore });
    editor.attachCanvas(canvas);
    canvas.setReadonly(this.mode === GraphTypeBuildMode.Readonly);
    this.schemaStore = editor;
    this.canvasStore = canvas;
  };

  destroySchemaStore = () => {
    this.schemaStore?.disposeReaction();
    this.canvasStore?.dispose();
    this.schemaStore = undefined;
    this.canvasStore = undefined;
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
