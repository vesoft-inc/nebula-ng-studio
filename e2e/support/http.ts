import { expect, type Page, type Request } from '@playwright/test';

export interface Reply {
  body: unknown;
  status?: number;
}
export const ok = (data?: unknown): Reply => ({ body: { code: 0, message: '', data } });
export const failure = (message: string, code = 1, status = 400): Reply => ({ status, body: { code, message } });
export function table(rows: Record<string, unknown>[], headers = Object.keys(rows[0] || {})) {
  return ok({ headers, tables: rows, latency: 0, summary: { rowsCount: rows.length, totalServerTimeUs: 1 } });
}
export async function intercept(
  page: Page,
  match: (url: URL) => boolean,
  respond: (request: Request) => Promise<Reply | undefined>
) {
  const unexpected: string[] = [];
  await page.route(match, async (route) => {
    const req = route.request();
    const result = await respond(req);
    if (!result) unexpected.push(req.method() + ' ' + new URL(req.url()).pathname + ' ' + (req.postData() || ''));
    const { status = 200, body } = result ?? failure('Unhandled fixture request', 1, 501);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return () => expect(unexpected, 'unhandled fixture requests').toEqual([]);
}
