import { test as base, type Request } from '@playwright/test';
import { ok, failure, table, intercept, type Reply } from './http';

export class StudioApi {
  user: string | null = 'alice';
  loginAs = 'alice';
  schema = '/initial';
  graphs = ['people-demo'];
  types = ['People'];
  consoleRequests: string[] = [];
  override?: (path: string, request: Request) => Promise<Reply | undefined>;
  query?: (gql: string, request: Request) => Promise<Reply | undefined>;
  snapshots = new Map<
    string,
    { id: string; name: string; graph: string; graph_type?: string; schemaPath: string; data: string }
  >();
  config = new Map<string, string>();
  nextSnapshot = 1;
  sketch?: { id: number; name: string; schema: string; snapshot: string };

  async respond(request: Request) {
    const path = new URL(request.url()).pathname.slice('/api-studio'.length);
    const method = request.method();
    const body = request.postDataJSON() ?? {};
    const custom = await this.override?.(path, request);
    if (custom) return custom;
    switch (method + ' ' + path) {
      case 'GET /db/oauth2-config':
        return ok({ enabled: false });
      case 'POST /db/connect':
        this.user = this.loginAs;
        return ok();
      case 'POST /db/disconnect':
        this.user = null;
        return ok();
      case 'GET /nebula/userInfo':
        return this.user
          ? ok({
              username: this.user,
              address: 'graphd:9669',
              curSchemaPath: this.schema,
              roles: ['ADMIN'],
              coreVersion: '5.4',
              version: 'dev',
            })
          : failure('Session expired', 40104001, 401);
      case 'POST /nebula/changeSchema':
        this.schema = body.schemaPath;
        return ok();
      case 'POST /nebula/console/execGql':
        if (body.gql === 'SHOW WARNINGS') return table([]);
        this.consoleRequests.push(body.gql);
        return this.query?.(body.gql, request);
      case 'POST /gql/exec': {
        const gql = body.gql as string;
        const rows = ['/initial', '/other'].map((path) => ({ name: path.slice(1), path, owner: 'alice' }));
        if (gql === 'SHOW SCHEMAS') return table(rows);
        if (gql === 'SHOW CURRENT_SCHEMA') return table(rows.filter((item) => item.path === this.schema));
        if (gql === 'SHOW GRAPH TYPES') return table(this.types.map((graph_type) => ({ graph_type, owner: 'alice' })));
        if (gql === 'SHOW GRAPHS')
          return table(this.graphs.map((name) => ({ name, graph_type: 'People', schema: this.schema })));
        if (gql.startsWith('call show_graphs()'))
          return table(
            this.graphs.map((graph) => ({
              graph,
              graph_type: 'People',
              schema: this.schema,
              owner: 'alice',
              index_cnt: 0,
            }))
          );
        if (gql.startsWith('CREATE GRAPH `')) {
          this.graphs.push(gql.split('`')[1]);
          return table([]);
        }
        if (gql.startsWith('CALL describe_graph(')) return table([]);
        if (
          (gql.startsWith('LET gtn =') && gql.includes('CALL describe_graph_type(gtn)')) ||
          gql.startsWith('CALL describe_graph_type(') ||
          gql.startsWith('DESCRIBE GRAPH TYPE ') ||
          /^USE .+ SHOW (?:INDEXES|STATS)$/.test(gql)
        )
          return table([]);
        break;
      }
      case 'POST /sketch/create':
        this.sketch = { ...body, id: 1 };
        return ok({ id: 1 });
      case 'GET /sketch/1':
        return this.sketch ? ok({ item: this.sketch }) : failure('Sketch missing', 40404000, 404);
      case 'GET /sketch/list':
        return ok({ items: this.sketch ? [this.sketch] : [], total: this.sketch ? 1 : 0, page: 1, pageSize: 10 });
      case 'POST /explorer/global-config/upsert':
        this.config.set(body.key, body.value);
        return ok(body);
      case 'GET /explorer/global-config':
        return ok({ items: [...this.config].map(([key, value]) => ({ key, value })), total: this.config.size });
      case 'GET /explorer/icongroup':
        return ok({ items: [] });
      case 'GET /explorer/snapshots': {
        const filter = JSON.parse(new URL(request.url()).searchParams.get('filter') ?? '{}');
        const items = [...this.snapshots.values()].filter(
          (snapshot) => snapshot.schemaPath === filter.schema_path && (!filter.id || snapshot.id === filter.id)
        );
        return ok({ items, total: items.length });
      }
      case 'POST /explorer/snapshots': {
        const id = String(this.nextSnapshot++);
        this.snapshots.set(id, { ...body, id, schemaPath: body.schema_path });
        return ok({ id });
      }
    }
    if (method === 'GET' && path.startsWith('/explorer/global-config/')) {
      const key = decodeURIComponent(path.slice('/explorer/global-config/'.length));
      return this.config.has(key)
        ? ok({ key, value: this.config.get(key) })
        : failure('No saved settings', 40404000, 404);
    }
    if (path.startsWith('/explorer/snapshots/')) {
      const id = decodeURIComponent(path.slice('/explorer/snapshots/'.length));
      const snapshot = this.snapshots.get(id);
      if (!snapshot) return failure('Snapshot missing', 40404000, 404);
      if (method === 'GET') return ok(snapshot);
      if (method === 'PUT') {
        Object.assign(snapshot, body);
        return ok();
      }
      if (method === 'DELETE') {
        this.snapshots.delete(id);
        return ok();
      }
    }
    return undefined;
  }
}
export const test = base.extend<{ api: StudioApi }>({
  api: async ({ page }, use) => {
    const api = new StudioApi();
    // Studio Server expands the production index template before serving a deep link.
    await page.route(
      (url) => url.pathname.startsWith('/studio/'),
      async (route) => {
        if (!route.request().isNavigationRequest()) return route.fallback();
        const response = await route.fetch();
        const html = (await response.text())
          .replaceAll('{{.basePath}}', '/studio')
          .replaceAll('{{.defaultHost}}', 'graphd')
          .replaceAll('{{.defaultPort}}', '9669');
        await route.fulfill({ response, body: html });
      }
    );
    const verify = await intercept(
      page,
      (url) => url.pathname.startsWith('/api-studio/'),
      (req) => api.respond(req)
    );
    await use(api);
    verify();
  },
});
