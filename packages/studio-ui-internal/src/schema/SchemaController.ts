import { GQLResult, GraphEntityType, type ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { safeArray } from '@vesoft-inc/studio-core';
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
} from './types';
import type { SchemaServices } from './services';
import { action, makeAutoObservable, observable, reaction, type IReactionDisposer } from 'mobx';

type SchemaStoreDeps = { getCurrentSchemaPath: () => string | undefined };

const emptyCurrentSchema = (): NebulaSchema =>
  ({
    name: '',
    path: '',
    owner: '',
    graphTypes: [],
    graphs: [],
  }) as NebulaSchema;

export default class SchemaStore {
  deps?: SchemaStoreDeps;
  reactionDisposer?: IReactionDisposer;
  schemas = observable.array<ISchemaItem>([]);
  selectedKeys = observable.array<string>([]);
  createGraphModalInfo = {
    visible: false,
  };
  currentSchema: NebulaSchema = emptyCurrentSchema();
  loading = true;

  get currentSchemaPath() {
    return this.deps?.getCurrentSchemaPath() ?? this.currentSchema.path;
  }

  private generation = 0;
  private sessionGeneration = 0;
  private schemaSwitchQueue: Promise<void> = Promise.resolve();
  private pendingSchemaSwitches = 0;
  private abort = new AbortController();

  constructor(public readonly services: SchemaServices) {
    makeAutoObservable<this, 'abort' | 'schemaSwitchQueue' | 'sessionGeneration'>(this, {
      selectedKeys: observable.shallow,
      deps: false,
      reactionDisposer: false,
      currentSchemaPath: false,
      services: false,
      abort: false,
      schemaSwitchQueue: false,
      sessionGeneration: false,
    });
    this.bindSchemaReaction();
  }

  attach = (deps: SchemaStoreDeps) => {
    this.deps = deps;
    this.bindSchemaReaction();
  };

  /**
   * Drop the current reaction, clear the catalog, then bind exactly one reaction again.
   * Logout uses this so a second login does not stack reactions on the process-wide instance.
   */
  reset = () => {
    this.generation += 1;
    this.sessionGeneration += 1;
    this.schemaSwitchQueue = Promise.resolve();
    this.pendingSchemaSwitches = 0;
    this.abort.abort();
    this.abort = new AbortController();
    this.reactionDisposer?.();
    this.reactionDisposer = undefined;
    this.schemas.clear();
    this.selectedKeys.clear();
    this.currentSchema = emptyCurrentSchema();
    this.createGraphModalInfo = { visible: false };
    this.loading = true;
    this.bindSchemaReaction();
  };

  destroy = () => {
    this.reset();
    this.reactionDisposer?.();
    this.reactionDisposer = undefined;
    this.abort.abort();
  };

  bindSchemaReaction = () => {
    this.reactionDisposer?.();
    this.reactionDisposer = reaction(
      () => {
        const path = this.currentSchemaPath;
        // Replacing currentSchema must not retrigger synchronization of the same catalog entry.
        return this.schemas.find((schema) => schema.path === path);
      },
      (schema) => {
        if (schema) this.updateCurrentSchame(schema);
      }
    );
  };

  updateCurrentSchame = (schema: Partial<NebulaSchema>) => {
    if (schema.path && schema.path !== this.currentSchema.path) {
      this.generation += 1;
      this.abort.abort();
      this.abort = new AbortController();
      this.currentSchema = emptyCurrentSchema();
    }
    this.currentSchema = {
      ...this.currentSchema,
      ...schema,
    };
    this.updateLoading(false);
  };

  getSchemas = async () => {
    const generation = this.generation;
    const gql = `SHOW SCHEMAS`;
    const res = await this.services.execute<GQLResult<ISchemaItem>>(gql, { signal: this.abort.signal });
    const curSchemas: ISchemaItem[] = safeArray(res.data?.tables).map((item: ISchemaItem) => ({
      name: item.name,
      path: item.path,
      owner: item.owner,
    }));
    if (generation === this.generation) this.updateSchemas(curSchemas);
  };

  refreshCurrentSchema = async () => {
    const generation = this.generation;
    const initialSchemaPath = this.currentSchema?.path;
    const res = await this.services.execute<{ tables: ISchemaItem[] }>('SHOW CURRENT_SCHEMA', {
      signal: this.abort.signal,
    });
    const currentSchema = res.data?.tables?.[0];
    if (
      generation === this.generation &&
      res.code === 0 &&
      currentSchema &&
      this.currentSchema?.path === initialSchemaPath
    ) {
      this.updateCurrentSchame(currentSchema);
    }
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
    const res = await this.services.execute<GQLResult<GraphType>>(gql, { signal: this.abort.signal });
    return { graphTypes: (res.data?.tables || []) as GraphType[], ok: res.code === 0 };
  };

  getCreateGraphTypeDDL = async (graphType: string) => {
    const ngql = `SHOW CREATE GRAPH TYPE \`${graphType}\``;
    const res = await this.services.execute<
      GQLResult<{ graph_type_name: string; create_graph_type_statement: string }>
    >(ngql, { signal: this.abort.signal });
    const tableData = (res.data?.tables || []) as { graph_type_name: string; create_graph_type_statement: string }[];
    return tableData?.[0]?.create_graph_type_statement;
  };

  updateGraphTypesBySchema = async () => {
    const generation = this.generation;
    const { graphTypes, ok } = await this.queryGraphTypes();
    if (generation !== this.generation) return;
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
    void this.services
      .sweepLayouts?.(
        this.currentSchema.path,
        graphTypes.map((item) => item.graph_type)
      )
      .catch(() => {});
  };

  getGraphs = async () => {
    const gql =
      'call show_graphs() yield name as gn,graph_type,`schema` AS sa, owner optional call show_indexes(gn) return gn as graph_name, graph_type, sa, owner, count(name) as index_cnt group by graph_name, graph_type, sa ,owner next return graph_name as "graph",  graph_type, sa as "schema", owner, index_cnt';
    const res = await this.services.execute<GQLResult<GraphItem>>(gql, { signal: this.abort.signal });
    const graphs = (res.data?.tables || []) as GraphItem[];
    return graphs;
  };

  updateGraphsBySchema = async () => {
    const generation = this.generation;
    const graphs = await this.getGraphs();
    if (generation !== this.generation) return;
    this.updateCurrentSchame({
      graphs,
    });
  };

  sessionSetSchema = async (schemaPath: string) => {
    const gql = `SESSION SET SCHEMA \`${schemaPath}\``;
    const res = await this.services.execute<GQLResult>(gql, { signal: this.abort.signal });
    return res;
  };

  getGraphTypeDetail = async (graphTypeName: string) => {
    const gql = `DESCRIBE GRAPH TYPE \`${graphTypeName}\``;
    const res = await this.services.execute<GQLResult<GraphTypeElement>>(gql, { signal: this.abort.signal });
    return (res.data?.tables || []) as GraphTypeElement[];
  };

  updateGraphTypeDetailBySchema = async (graphTypeName: string) => {
    const generation = this.generation;
    const graphType = this.currentSchema.graphTypes.find((graphType) => graphType.graph_type === graphTypeName)!;
    const entities = await this.getGraphTypeDetail(graphTypeName);
    if (generation !== this.generation || !graphType) return;
    graphType.entities = entities;
    this.updateCurrentSchame({
      graphTypes: this.currentSchema.graphTypes,
    });
  };

  getEdgeTypeDesc = async (gtn: string, edgeTypeName: string) => {
    const gql = `DESCRIBE EDGE TYPE \`${edgeTypeName}\` OF \`${gtn}\` `;
    const res = await this.services.execute<GQLResult<DescEdgeTypeResult>>(gql, { signal: this.abort.signal });
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
    const res = await this.services.execute<GQLResult<DescNodeTypeResult>>(gql, { signal: this.abort.signal });
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
    const generation = this.generation;
    const graphType = this.currentSchema.graphTypes.find((graphType) => graphType.graph_type === graph_type_name)!;
    if (!graphType) return;
    const entity = graphType.entities.find((entity) => entity.type_name === entity_type_name)!;
    if (!entity) return;
    if (entity.entity_type === GraphEntityType.Node) {
      const properties = await this.getNodeTypeDesc(graph_type_name, entity_type_name);
      if (generation !== this.generation) return;
      // @ts-ignore
      entity.propertyInfos = properties;
    } else if (entity.entity_type === GraphEntityType.Edge) {
      const properties = await this.getEdgeTypeDesc(graph_type_name, entity_type_name);
      if (generation !== this.generation) return;
      // @ts-ignore
      entity.propertyInfos = properties;
    }
    this.updateCurrentSchame({
      graphTypes: this.currentSchema.graphTypes,
    });
  };

  importDemoDataset = async (dataSet: string) => {
    const res = (await this.services.importDataset?.(dataSet)) ?? { code: -1 };
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
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    return res;
  };

  dropSchema = async (schemaPath: string) => {
    const ngql = `DROP SCHEMA IF EXISTS \`${schemaPath}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    return res;
  };

  createSchema = async (schemaPath: string) => {
    const ngql = `CREATE SCHEMA \`${schemaPath}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    return res;
  };

  createGraph = async (graphName: string, graphType: string) => {
    const ngql = `CREATE GRAPH \`${graphName}\` :: \`${graphType}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    return res;
  };

  dropGraph = async (graphName: string) => {
    const ngql = `DROP GRAPH IF EXISTS \`${graphName}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    return res;
  };

  getIndexesInfo = async (graphName: string) => {
    const ngql = `USE \`${graphName}\` SHOW INDEXES`;
    const res = await this.services.execute<GQLResult<IGraphIndex>>(ngql, { signal: this.abort.signal });
    return (res.data?.tables || []) as IGraphIndex[];
  };

  dropIndex = async (graphName: string, indexName: string) => {
    const ngql = `USE \`${graphName}\` DROP INDEX IF EXISTS \`${indexName}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    return res;
  };

  getEntityTypeInfoByGraphName = async (graphName: string) => {
    const ngql = `CALL describe_graph("${graphName}") CALL describe_graph_type(graph_type_name) return *`;
    const res = await this.services.execute<
      GQLResult<
        GraphTypeElement & {
          graph_name: string;
          graph_type_name: string;
        }
      >
    >(ngql, { signal: this.abort.signal });
    return res.data?.tables || [];
  };

  showJobs = async () => {
    const ngql = `SHOW JOBS`;
    const res = await this.services.execute<GQLResult<IGraphStats>>(ngql, { signal: this.abort.signal });
    // return (res.data?.tables || []);
    return res.data;
  };

  showStats = async (graphName: string, { isManual }: { isManual?: boolean } = {}) => {
    const ngql = `USE \`${graphName}\` SHOW STATS`;
    const res = await this.services.execute<GQLResult<IGraphStats>>(ngql, {
      signal: this.abort.signal,
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
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    return res;
  };

  updateCreateGraphModalInfo = (info: { visible: boolean }) => {
    this.createGraphModalInfo = info;
  };

  get switchingSchema() {
    return this.pendingSchemaSwitches > 0;
  }

  switchSchema = (schemaPath: string): Promise<ServerResponse<object>> => {
    const sessionGeneration = this.sessionGeneration;
    this.pendingSchemaSwitches += 1;
    // Session mutations must finish in order; ignoring an old response cannot undo its server-side effect.
    const request = this.schemaSwitchQueue
      .then(async () => {
        if (sessionGeneration !== this.sessionGeneration) {
          throw new DOMException('Schema switch cancelled', 'AbortError');
        }
        const res = await (this.services.switchSchema?.(schemaPath) ?? this.sessionSetSchema(schemaPath));
        if (sessionGeneration !== this.sessionGeneration) {
          throw new DOMException('Schema switch cancelled', 'AbortError');
        }
        if (res.code === 0) {
          this.updateCurrentSchame(
            this.schemas.find((schema) => schema.path === schemaPath) ?? {
              path: schemaPath,
              name: schemaPath.split('/').pop() ?? '',
            }
          );
        }
        return res;
      })
      .finally(
        action(() => {
          if (sessionGeneration === this.sessionGeneration) this.pendingSchemaSwitches -= 1;
        })
      );
    this.schemaSwitchQueue = request.then(
      () => undefined,
      () => undefined
    );
    return request;
  };

  updateLoading = (loading: boolean) => {
    this.loading = loading;
  };
}
