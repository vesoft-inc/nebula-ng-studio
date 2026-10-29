// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { HttpResCode, HTTP_CANCEL_CODE } from '@vesoft-inc/studio-core/contracts';
import { fetcher } from './fetcher';
import { guiConsoleServices } from './console';
import { fetchCoreInfo } from './nebula';

vi.mock('@vesoft-inc/studio-ui-internal/modal', () => ({ modalStore: { message: { error: vi.fn() } } }));

const originalAdapter = fetcher.defaults.adapter;
afterEach(() => {
  fetcher.defaults.adapter = originalAdapter;
  sessionStorage.clear();
});

function respond(body: object) {
  fetcher.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify(body),
  });
}

it('retains the HTTP envelope while services read the typed body', async () => {
  respond({ version: '5.0', protocolVersion: '1' });
  sessionStorage.setItem('nebula-gui-token', 'session-token');
  const response = await fetcher.get<{ version: string }>('/info');
  expect(response.status).toBe(200);
  expect(response.data.version).toBe('5.0');
  expect(response.config.headers.get('Authorization')).toBe('Bearer session-token');
  expect(await fetchCoreInfo()).toMatchObject({ version: '5.0', protocolVersion: '1' });
});

it('adapts an encoded REST query result to the Console result contract', async () => {
  const result = {
    code: '00000',
    cursor: '',
    message: '',
    data: { headers: ['n'], tables: [{ n: 1 }] },
    summary: {
      elapsedTime: { buildTimeUs: 0, optimizeTimeUs: 0, parseTimeUs: 0, serializeTimeUs: 0, totalServerTimeUs: 0 },
      explainType: '',
      queryStats: { numAffectedEdges: 0, numAffectedNodes: 0 },
    },
  };
  respond({ code: 0, data: JSON.stringify(result) });
  const response = await guiConsoleServices.execute('RETURN 1');
  expect(response).toMatchObject({ code: 0, data: { headers: ['n'], tables: [{ n: 1 }], summary: { rowsCount: 1 } } });
});

it('normalizes a REST query error code at the service boundary', async () => {
  respond({ code: '00042', message: 'query failed' });
  expect(await guiConsoleServices.execute('invalid query')).toEqual({
    code: 42,
    message: 'query failed',
    data: undefined,
  });
});

it.each([
  ['ERR_NETWORK', HttpResCode.ErrUnknown],
  ['ERR_CANCELED', HTTP_CANCEL_CODE],
])('preserves the %s failure contract', async (code, expectedCode) => {
  fetcher.defaults.adapter = async (config) => {
    throw Object.assign(new Error('request failed'), { code, config });
  };
  expect(await guiConsoleServices.execute('RETURN 1')).toEqual({
    code: expectedCode,
    message: 'request failed',
    data: undefined,
  });
});
