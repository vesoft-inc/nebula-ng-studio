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
import { action, makeAutoObservable, observable, reaction, runInAction, type IReactionDisposer } from 'mobx';

type SchemaStoreDeps = { getCurrentSchemaPath: () => string | undefined };
type MetadataCollection = 'schemas' | 'current-schema' | 'graph-types' | 'graphs';

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
  private metadataRequests = new Map<string, Promise<ServerResponse<object>>>();
  private metadataVersions: Record<MetadataCollection, number> = {
    schemas: 0,
    'current-schema': 0,
    'graph-types': 0,
    graphs: 0,
  };

  constructor(public readonly services: SchemaServices) {
    makeAutoObservable<
      this,
      'abort' | 'schemaSwitchQueue' | 'sessionGeneration' | 'metadataRequests' | 'metadataVersions'
    >(this, {
      selectedKeys: observable.shallow,
      deps: false,
      reactionDisposer: false,
      currentSchemaPath: false,
      services: false,
      abort: false,
      schemaSwitchQueue: false,
      sessionGeneration: false,
      metadataRequests: false,
      metadataVersions: false,
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
    this.metadataRequests.clear();
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
      this.metadataRequests.clear();
      this.abort = new AbortController();
      this.currentSchema = emptyCurrentSchema();
    }
    this.currentSchema = {
      ...this.currentSchema,
      ...schema,
    };
    this.updateLoading(false);
  };

  /** Share only pending metadata reads, including reads requested by sibling views. */
  private readMetadata = <T extends object>(
    gql: string,
    collection: MetadataCollection
  ): Promise<ServerResponse<T>> => {
    const generation = this.generation;
    const version = this.metadataVersions[collection];
    const key = `${collection}:${generation}:${version}:${gql}`;
    const pending = this.metadataRequests.get(key);
    if (pending) return pending as Promise<ServerResponse<T>>;
    const assertFresh = () => {
      if (generation === this.generation && version !== this.metadataVersions[collection])
        throw new DOMException('Metadata changed while the request was pending', 'AbortError');
    };
    const request = this.services
      .execute<T>(gql, { signal: this.abort.signal })
      .finally(() => {
        if (this.metadataRequests.get(key) === request) this.metadataRequests.delete(key);
      })
      .then(
        (response) => {
          assertFresh();
          return response;
        },
        (error) => {
          assertFresh();
          throw error;
        }
      );
    this.metadataRequests.set(key, request);
    return request;
  };

  private invalidateMetadata = (...collections: MetadataCollection[]) => {
    for (const collection of collections) {
      this.metadataVersions[collection]++;
      for (const key of this.metadataRequests.keys())
        if (key.startsWith(`${collection}:`)) this.metadataRequests.delete(key);
    }
  };

  getSchemas = async () => {
    const generation = this.generation;
    const version = this.metadataVersions.schemas;
    const gql = `SHOW SCHEMAS`;
    const res = await this.readMetadata<GQLResult<ISchemaItem>>(gql, 'schemas');
    const curSchemas: ISchemaItem[] = safeArray(res.data?.tables).map((item: ISchemaItem) => ({
      name: item.name,
      path: item.path,
      owner: item.owner,
    }));
    if (generation === this.generation && version === this.metadataVersions.schemas) this.updateSchemas(curSchemas);
    return res;
  };

  refreshCurrentSchema = async () => {
    const generation = this.generation;
    const initialSchemaPath = this.currentSchema?.path;
    const res = await this.readMetadata<{ tables: ISchemaItem[] }>('SHOW CURRENT_SCHEMA', 'current-schema');
    const currentSchema = res.data?.tables?.[0];
    if (
      generation === this.generation &&
      res.code === 0 &&
      currentSchema &&
      this.currentSchema?.path === initialSchemaPath
    ) {
      this.updateCurrentSchame(currentSchema);
    }
    return res;
  };

  unsafeAction = (fn: (store: this) => void) => action('unsafeAction', () => fn(this))();

  getGraphTypes = async () => (await this.queryGraphTypes()).graphTypes;

  /**
   * `SHOW GRAPH TYPES` plus whether it succeeded. The success flag matters for the
   * layout sweep: an empty list from a failed query must not be read as "every
   * graph type is gone".
   */
  queryGraphTypes = async () => {
    const gql = `SHOW GRAPH TYPES`;
    const res = await this.readMetadata<GQLResult<GraphType>>(gql, 'graph-types');
    return { graphTypes: (res.data?.tables || []) as GraphType[], ok: res.code === 0, response: res };
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
    const version = this.metadataVersions['graph-types'];
    const { graphTypes, ok, response } = await this.queryGraphTypes();
    if (generation !== this.generation || version !== this.metadataVersions['graph-types']) return;
    this.updateCurrentSchame({
      graphTypes,
    });

    if (ok) {
      this.sweepStaleLayouts(graphTypes);
    }
    return response;
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

  private queryGraphs = () => {
    const gql =
      'call show_graphs() yield name as gn,graph_type,`schema` AS sa, owner optional call show_indexes(gn) return gn as graph_name, graph_type, sa, owner, count(name) as index_cnt group by graph_name, graph_type, sa ,owner next return graph_name as "graph",  graph_type, sa as "schema", owner, index_cnt';
    return this.readMetadata<GQLResult<GraphItem>>(gql, 'graphs');
  };

  getGraphs = async () => ((await this.queryGraphs()).data?.tables || []) as GraphItem[];

  updateGraphsBySchema = async () => {
    const generation = this.generation;
    const version = this.metadataVersions.graphs;
    const response = await this.queryGraphs();
    const graphs = (response.data?.tables || []) as GraphItem[];
    if (generation !== this.generation || version !== this.metadataVersions.graphs) return;
    this.updateCurrentSchame({
      graphs,
    });
    return response;
  };

  sessionSetSchema = async (schemaPath: string) => {
    const gql = `SESSION SET SCHEMA \`${schemaPath}\``;
    const res = await this.services.execute<GQLResult>(gql, { signal: this.abort.signal });
    return res;
  };

  private queryGraphTypeDetail = (graphTypeName: string) => {
    const gql = `DESCRIBE GRAPH TYPE \`${graphTypeName}\``;
    return this.readMetadata<GQLResult<GraphTypeElement>>(gql, 'graph-types');
  };

  getGraphTypeDetail = async (graphTypeName: string) =>
    ((await this.queryGraphTypeDetail(graphTypeName)).data?.tables || []) as GraphTypeElement[];

  updateGraphTypeDetailBySchema = async (graphTypeName: string) => {
    const generation = this.generation;
    const version = this.metadataVersions['graph-types'];
    const graphType = this.currentSchema.graphTypes.find((graphType) => graphType.graph_type === graphTypeName)!;
    const response = await this.queryGraphTypeDetail(graphTypeName);
    const entities = (response.data?.tables || []) as GraphTypeElement[];
    if (generation !== this.generation || version !== this.metadataVersions['graph-types'] || !graphType) return;
    runInAction(() => {
      graphType.entities = entities;
      this.updateCurrentSchame({ graphTypes: this.currentSchema.graphTypes });
    });
    return response;
  };

  private queryEdgeTypeDesc = (gtn: string, edgeTypeName: string) => {
    const gql = `DESCRIBE EDGE TYPE \`${edgeTypeName}\` OF \`${gtn}\` `;
    return this.readMetadata<GQLResult<DescEdgeTypeResult>>(gql, 'graph-types');
  };

  getEdgeTypeDesc = async (gtn: string, edgeTypeName: string) => {
    const res = await this.queryEdgeTypeDesc(gtn, edgeTypeName);
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

  private queryNodeTypeDesc = (gtn: string, nodeTypeName: string) => {
    const gql = `DESCRIBE NODE TYPE \`${nodeTypeName}\` OF \`${gtn}\` `;
    return this.readMetadata<GQLResult<DescNodeTypeResult>>(gql, 'graph-types');
  };

  getNodeTypeDesc = async (gtn: string, nodeTypeName: string) => {
    const res = await this.queryNodeTypeDesc(gtn, nodeTypeName);
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
    const version = this.metadataVersions['graph-types'];
    const graphType = this.currentSchema.graphTypes.find((graphType) => graphType.graph_type === graph_type_name)!;
    if (!graphType) return;
    const entity = graphType.entities.find((entity) => entity.type_name === entity_type_name)!;
    if (!entity) return;
    const response = await (entity.entity_type === GraphEntityType.Node
      ? this.queryNodeTypeDesc(graph_type_name, entity_type_name)
      : this.queryEdgeTypeDesc(graph_type_name, entity_type_name));
    if (generation !== this.generation || version !== this.metadataVersions['graph-types']) return;
    runInAction(() => {
      if (entity.entity_type === GraphEntityType.Node) {
        // @ts-ignore
        entity.propertyInfos = (response.data?.tables || []).map((property) => ({
          ...property,
          type: GraphEntityType.Node,
          type_name: entity_type_name,
        }));
      } else if (entity.entity_type === GraphEntityType.Edge) {
        // @ts-ignore
        entity.propertyInfos = (response.data?.tables || []).map((property) => ({
          ...property,
          type: GraphEntityType.Edge,
          type_name: entity_type_name,
        }));
      }
      this.updateCurrentSchame({
        graphTypes: this.currentSchema.graphTypes,
      });
    });
    return response;
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
    const generation = this.generation;
    const ngql = `DROP GRAPH TYPE IF EXISTS \`${graphTypeName}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    if (res.code === 0 && generation === this.generation) this.invalidateMetadata('graph-types', 'graphs');
    return res;
  };

  dropSchema = async (schemaPath: string) => {
    const generation = this.generation;
    const ngql = `DROP SCHEMA IF EXISTS \`${schemaPath}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    if (res.code === 0 && generation === this.generation) this.invalidateMetadata('schemas');
    return res;
  };

  createSchema = async (schemaPath: string) => {
    const generation = this.generation;
    const ngql = `CREATE SCHEMA \`${schemaPath}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    if (res.code === 0 && generation === this.generation) this.invalidateMetadata('schemas');
    return res;
  };

  createGraph = async (graphName: string, graphType: string) => {
    const generation = this.generation;
    const ngql = `CREATE GRAPH \`${graphName}\` :: \`${graphType}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    if (res.code === 0 && generation === this.generation) this.invalidateMetadata('graphs');
    return res;
  };

  dropGraph = async (graphName: string) => {
    const generation = this.generation;
    const ngql = `DROP GRAPH IF EXISTS \`${graphName}\``;
    const res = await this.services.execute<GQLResult>(ngql, { signal: this.abort.signal });
    if (res.code === 0 && generation === this.generation) this.invalidateMetadata('graphs');
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
        const generation = this.generation;
        const res = await (this.services.switchSchema?.(schemaPath) ?? this.sessionSetSchema(schemaPath));
        if (
          sessionGeneration !== this.sessionGeneration ||
          (generation !== this.generation && this.currentSchema.path !== schemaPath)
        ) {
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
