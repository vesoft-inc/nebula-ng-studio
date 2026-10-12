import { GQLResult, GraphEntityType, safeArray } from '@vesoft-inc/utils';
import {
  DescEdgeTypeResult,
  DescNodeTypeResult,
  GraphItem,
  GraphType,
  GraphTypeElement,
  IGraphIndex,
  IGraphStats,
  ISchemaItem,
  NebulaSchema,
} from '@studio/interfaces';
import {
  changeSchema,
  execGql,
  importDataParams,
  resolveSchemaPath,
  sweepStaleGraphTypeLayouts,
} from '@studio/services';
import { action, makeAutoObservable, observable, reaction } from 'mobx';
import { RootStore } from '.';

export default class SchemaStore {
  rootStore?: RootStore;
  schemas = observable.array<ISchemaItem>([]);
  selectedKeys = observable.array<string>([]);
  createGraphModalInfo = {
    visible: false,
  };
  currentSchema: NebulaSchema = {
    name: '',
    path: '',
    owner: '',
    graphTypes: [],
    graphs: [],
  } as NebulaSchema;
  loading = true;

  get userInfo() {
    return this.rootStore?.commonStore.userInfo;
  }

  constructor(rootStore?: RootStore) {
    makeAutoObservable(this, {
      selectedKeys: observable.shallow,
    });
    this.rootStore = rootStore;
    reaction(
      () => [this.schemas.slice(), this.userInfo],
      () => {
        if (this.schemas.length > 0) {
          const curSchema = this.schemas.find((schema) => schema.path === this.userInfo?.curSchemaPath);
          if (curSchema) {
            this.updateCurrentSchame(curSchema);
          }
        }
      }
    );
  }

  updateCurrentSchame = (schema: Partial<NebulaSchema>) => {
    this.currentSchema = {
      ...this.currentSchema,
      ...schema,
    };
    this.updateLoading(false);
  };

  getSchemas = async () => {
    const gql = `SHOW SCHEMAS`;
    const res = await execGql<GQLResult<ISchemaItem>>(gql);
    const curSchemas: ISchemaItem[] = safeArray(res.data?.tables).map((item: ISchemaItem) => ({
      name: item.name,
      path: item.path,
      owner: item.owner,
    }));
    this.updateSchemas(curSchemas);
  };

  unsafeAction = (fn: (store: this) => void) => action('unsafeAction', () => fn(this))();

  getGraphTypes = async () => (await this.queryGraphTypes()).graphTypes;

  /**
   * `SHOW GRAPH TYPES` plus whether it succeeded. The success flag matters for the
   * layout sweep: an empty list from a failed query must not be read as "every
   * graph type is gone".
   */
  queryGraphTypes = async (): Promise<{ graphTypes: GraphType[]; ok: boolean }> => {
    const gql = `SHOW GRAPH TYPES`;
    const res = await execGql<GQLResult<GraphType>>(gql);
    return { graphTypes: (res.data?.tables || []) as GraphType[], ok: res.code === 0 };
  };

  getCreateGraphTypeDDL = async (graphType: string) => {
    const ngql = `SHOW CREATE GRAPH TYPE \`${graphType}\``;
    const res = await execGql<GQLResult<{ graph_type_name: string; create_graph_type_statement: string }>>(ngql);
    const tableData = (res.data?.tables || []) as { graph_type_name: string; create_graph_type_statement: string }[];
    return tableData?.[0].create_graph_type_statement;
  };

  updateGraphTypesBySchema = async () => {
    const { graphTypes, ok } = await this.queryGraphTypes();
    this.updateCurrentSchame({
      graphTypes,
    });

    if (ok) {
      this.sweepStaleLayouts(graphTypes);
    }
  };

  /**
   * Layouts of deleted graph types would otherwise linger forever. The list just
   * queried is the live set of the session's schema path, so it is also the only
   * moment at which staleness can be judged.
   */
  sweepStaleLayouts = (graphTypes: GraphType[]) => {
    const userInfo = this.userInfo;
    const schemaPath = resolveSchemaPath(userInfo?.curSchemaPath, this.currentSchema.path);

    sweepStaleGraphTypeLayouts(
      { address: userInfo?.address, username: userInfo?.username, schemaPath },
      graphTypes.map((graphType) => graphType.graph_type)
    );
  };

  getGraphs = async () => {
    const gql =
      'call show_graphs() yield name as gn,graph_type,`schema` AS sa, owner optional call show_indexes(gn) return gn as graph_name, graph_type, sa, owner, count(name) as index_cnt group by graph_name, graph_type, sa ,owner next return graph_name as "graph",  graph_type, sa as "schema", owner, index_cnt';
    const res = await execGql<GQLResult<GraphItem>>(gql);
    const graphs = (res.data?.tables || []) as GraphItem[];
    return graphs;
  };

  updateGraphsBySchema = async () => {
    const graphs = await this.getGraphs();
    this.updateCurrentSchame({
      graphs,
    });
  };

  sessionSetSchema = async (schemaPath: string) => {
    const gql = `SESSION SET SCHEMA \`${schemaPath}\``;
    const res = await execGql<GQLResult>(gql);
    return res;
  };

  getGraphTypeDetail = async (graphTypeName: string) => {
    const gql = `DESCRIBE GRAPH TYPE \`${graphTypeName}\``;
    const res = await execGql<GQLResult<GraphTypeElement>>(gql);
    return (res.data?.tables || []) as GraphTypeElement[];
  };

  updateGraphTypeDetailBySchema = async (graphTypeName: string) => {
    const graphType = this.currentSchema.graphTypes.find((graphType) => graphType.graph_type === graphTypeName)!;
    const entities = await this.getGraphTypeDetail(graphTypeName);
    graphType.entities = entities;
    this.updateCurrentSchame({
      graphTypes: this.currentSchema.graphTypes,
    });
  };

  getEdgeTypeDesc = async (gtn: string, edgeTypeName: string) => {
    const gql = `DESCRIBE EDGE TYPE \`${edgeTypeName}\` OF \`${gtn}\` `;
    const res = await execGql<GQLResult<DescEdgeTypeResult>>(gql);
    return (
      res.data?.tables ||
      ([] as (DescEdgeTypeResult & {
        type: GraphEntityType.Edge;
        type_name: string;
      })[])
    ).map((t) => ({
      ...t,
      type: GraphEntityType.Edge,
      type_name: edgeTypeName,
    }));
  };

  getNodeTypeDesc = async (gtn: string, nodeTypeName: string) => {
    const gql = `DESCRIBE NODE TYPE \`${nodeTypeName}\` OF \`${gtn}\` `;
    const res = await execGql<GQLResult<DescNodeTypeResult>>(gql);
    return (
      res.data?.tables ||
      ([] as (DescNodeTypeResult & {
        type: GraphEntityType.Node;
        type_name: string;
      })[])
    ).map((t) => ({
      ...t,
      type: GraphEntityType.Node,
      type_name: nodeTypeName,
    }));
  };

  updateEntityTypeDescsBySchema = async (graph_type_name: string, entity_type_name: string) => {
    const graphType = this.currentSchema.graphTypes.find((graphType) => graphType.graph_type === graph_type_name)!;
    const entity = graphType.entities.find((entity) => entity.type_name === entity_type_name)!;
    if (entity.entity_type === GraphEntityType.Node) {
      const properties = await this.getNodeTypeDesc(graph_type_name, entity_type_name);
      // @ts-ignore
      entity.propertyInfos = properties;
    } else if (entity.entity_type === GraphEntityType.Edge) {
      const properties = await this.getEdgeTypeDesc(graph_type_name, entity_type_name);
      // @ts-ignore
      entity.propertyInfos = properties;
    }
    this.updateCurrentSchame({
      graphTypes: this.currentSchema.graphTypes,
    });
  };

  importDemoDataset = async (dataSet: string) => {
    const res = await importDataParams(dataSet);
    return res;
  };

  updateSchemas = (schemas: ISchemaItem[]) => {
    this.schemas.replace(schemas);
  };

  updateSelectedKeys = (keys: string[]) => {
    this.selectedKeys.replace(keys);
  };

  dropGraphType = async (graphTypeName: string) => {
    const ngql = `DROP GRAPH TYPE IF EXISTS \`${graphTypeName}\``;
    const res = await execGql<GQLResult>(ngql);
    return res;
  };

  dropSchema = async (schemaPath: string) => {
    const ngql = `DROP SCHEMA IF EXISTS \`${schemaPath}\``;
    const res = await execGql<GQLResult>(ngql);
    return res;
  };

  createSchema = async (schemaPath: string) => {
    const ngql = `CREATE SCHEMA \`${schemaPath}\``;
    const res = await execGql<GQLResult>(ngql);
    return res;
  };

  createGraph = async (graphName: string, graphType: string) => {
    const ngql = `CREATE GRAPH \`${graphName}\` :: \`${graphType}\``;
    const res = await execGql<GQLResult>(ngql);
    return res;
  };

  dropGraph = async (graphName: string) => {
    const ngql = `DROP GRAPH IF EXISTS \`${graphName}\``;
    const res = await execGql<GQLResult>(ngql);
    return res;
  };

  getIndexesInfo = async (graphName: string) => {
    const ngql = `USE \`${graphName}\` SHOW INDEXES`;
    const res = await execGql<GQLResult<IGraphIndex>>(ngql);
    return (res.data?.tables || []) as IGraphIndex[];
  };

  dropIndex = async (graphName: string, indexName: string) => {
    const ngql = `USE \`${graphName}\` DROP INDEX IF EXISTS \`${indexName}\``;
    const res = await execGql<GQLResult>(ngql);
    return res;
  };

  getEntityTypeInfoByGraphName = async (graphName: string) => {
    const ngql = `CALL describe_graph("${graphName}") CALL describe_graph_type(graph_type_name) return *`;
    const res = await execGql<
      GQLResult<
        GraphTypeElement & {
          graph_name: string;
          graph_type_name: string;
        }
      >
    >(ngql);
    return res.data?.tables || [];
  };

  showJobs = async () => {
    const ngql = `SHOW JOBS`;
    const res = await execGql<GQLResult<IGraphStats>>(ngql);
    // return (res.data?.tables || []);
    return res.data;
  };

  showStats = async (graphName: string, { isManual }: { isManual?: boolean } = {}) => {
    const ngql = `USE \`${graphName}\` SHOW STATS`;
    const res = await execGql<GQLResult<IGraphStats>>(ngql, {
      errTip: true,
      errMsgInterceptor: (errMsg) => {
        if (isManual) {
          return errMsg;
        }
        // 仅在非手动触发时，屏蔽 NJ009 错误
        // （背景：在 schema -> graph -> stats 页面执行 showStats 时如果没有 execStats 的情况会出现 NJ009 错误）
        console.warn('Ignoring expected [NJ009] error when showing stats', '-', errMsg);
        return errMsg && (/^\[NJ009\]:/.test(errMsg) ? null : errMsg);
      },
    });
    return (res.data?.tables || []) as IGraphStats[];
  };

  execStats = async (graphName: string) => {
    const ngql = `SUBMIT JOB STATS \`${graphName}\``;
    const res = await execGql<GQLResult>(ngql);
    return res;
  };

  updateCreateGraphModalInfo = (info: { visible: boolean }) => {
    this.createGraphModalInfo = info;
  };

  switchSchema = async (schemaPath: string) => {
    const res = await changeSchema(schemaPath);
    return res;
  };

  updateLoading = (loading: boolean) => {
    this.loading = loading;
  };
}
