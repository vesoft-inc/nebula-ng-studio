import { test as base, type Request } from '@playwright/test';
import { intercept, ok, failure, type Reply } from './http';
export const guiRows = (tables: Record<string, unknown>[]): Reply => ({
  body: {
    code: '00000',
    data: { headers: Object.keys(tables[0] || {}), tables },
    summary: { elapsedTime: { totalServerTimeUs: 1 } },
  },
});
class GuiApi {
  user = 'alice';
  authorized = true;
  cancelIds: string[] = [];
  query?: (gql: string, req: Request) => Promise<Reply | undefined>;
  async respond(req: Request) {
    const path = new URL(req.url()).pathname;
    if (path === '/info' && req.method() === 'GET') return { body: { version: '5.4.0' } };
    if (path === '/auth' && req.method() === 'POST') {
      const { username, password } = req.postDataJSON();
      if (password !== 'correct') return failure('Invalid credentials', 1, 401);
      this.user = username;
      this.authorized = true;
      return ok({ token: 'fixture-token' });
    }
    if (!this.authorized) return failure('Session expired', 1, 401);
    if (req.method() === 'DELETE' && /^\/sessions\/[^/]+\/query$/.test(path)) {
      this.cancelIds.push(path.split('/')[2]);
      return ok();
    }
    if (path === '/signout' && req.method() === 'POST') {
      this.authorized = false;
      return ok();
    }
    if (path === '/gql' && req.method() === 'POST') {
      const gql = req.postDataJSON().gql;
      if (gql === 'SHOW WARNINGS') return guiRows([]);
      const custom = await this.query?.(gql, req);
      if (custom) return custom;
      if (gql === 'SHOW CURRENT_USER') return guiRows([{ name: this.user }]);
      if (gql === 'SHOW CURRENT_SESSION') return guiRows([{ id: 'session-A' }]);
      if (gql === 'SHOW GRAPHS' || gql.startsWith('call show_graphs()')) return guiRows([]);
    }
    return undefined;
  }
}
export const test = base.extend<{ api: GuiApi }>({
  api: async ({ page }, use) => {
    const api = new GuiApi();
    const verify = await intercept(
      page,
      (url) => !url.pathname.startsWith('/ui') && !/\.(?:[a-z0-9]+)$/i.test(url.pathname) && url.pathname !== '/',
      (req) => api.respond(req)
    );
    await use(api);
    verify();
  },
});
