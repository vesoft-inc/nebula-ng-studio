import { action, makeAutoObservable, observable } from 'mobx';
import SchemaStore from './SchemaEditorState';
import type { SchemaEditorServices } from './services';
import { GraphTypeBuildMode, SketchListItem } from '../schema/types';
import { GQLResult } from '@vesoft-inc/utils';
import { CanvasStore } from './Builder/VisualBuilder/store';

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

  private generation = 0;

  constructor(public readonly services: SchemaEditorServices) {
    this.sketchListItem = { items: [], total: 0, page: 1, pageSize: 10 };
    makeAutoObservable(this, {
      setLoading: action,
      services: false,
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
    const generation = this.generation;
    const res = await this.services.execute<GQLResult<{ graphList: string[]; name: string }>>(gql);
    if (generation !== this.generation) return;
    const tableData = res.data?.tables || [];
    this.updateGraphTypeList(tableData);
  };

  updateGraphTypeList = (graphTypeList: IGraphTypeItem[]) => {
    this.graphTypeList.replace(graphTypeList);
  };

  initSchemaStore = () => {
    if (this.schemaStore) return;
    const editor = new SchemaStore(this.services);
    const canvas = new CanvasStore();
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

  destroy = () => {
    this.generation += 1;
    this.destroySchemaStore();
    this.graphTypeList.clear();
    this.sketchListItem = { items: [], total: 0, page: 1, pageSize: 10 };
  };

  setLoading = (loading: boolean) => {
    this.loading = loading;
  };

  updateSketchListItem = (sketchListItem: SketchListItem) => {
    this.sketchListItem = sketchListItem;
  };

  fetchSketchList = async (keyword?: string, page?: number, pageSize?: number) => {
    if (!this.services.sketches) return;
    const generation = this.generation;
    const res = await this.services.sketches.list({ keyword, page, pageSize });
    if (generation !== this.generation) return;
    if (res.code === 0) {
      this.updateSketchListItem(res.data!);
    }
  };
}

export default GraphTypeStore;
