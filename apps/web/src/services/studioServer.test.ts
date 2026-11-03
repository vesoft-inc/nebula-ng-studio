import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { modalStore } from '@vesoft-inc/studio-ui-internal/modal';
import { fetcher, backgroundFetcher } from './fetcher';
import { StudioServerAdapters } from './studioServer';
import { sessionRequests } from './sessionRequests';
import { createSchemaServices } from './schemaCatalog';
import { createExplorerServices } from './explorerWorkbench';
import { execConsoleGql } from './nebula';

vi.mock('@vesoft-inc/studio-ui-internal/modal', () => ({ modalStore: { message: { error: vi.fn() } } }));

const original = fetcher.defaults.adapter;
const originalBackground = backgroundFetcher.defaults.adapter;
const identity = { address: 'graphd:9669', username: 'root', schemaPath: '/demo' };
const layout = { Person: { x: 1, y: 2 } };

function reply(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    config,
    data: JSON.stringify(data),
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
  };
}

beforeEach(() => {
  sessionRequests.reset();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  sessionRequests.reset();
  fetcher.defaults.adapter = original;
  backgroundFetcher.defaults.adapter = originalBackground;
  vi.restoreAllMocks();
});

describe('Studio service session ownership', () => {
  it('reuses the same Schema editor service and write queue when a route returns', async () => {
    const adapters = new StudioServerAdapters();
    let complete!: () => void;
    const requests: InternalAxiosRequestConfig[] = [];
    backgroundFetcher.defaults.adapter = (config) => {
      requests.push(config);
      if (requests.length === 1)
        return new Promise((resolve) => {
          complete = () => resolve(reply(config, { code: 0 }));
        });
      return Promise.resolve(reply(config, { code: 0 }));
    };
    const first = adapters.editor(identity);
    const saved = first.layouts!.write('People', layout);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    const returned = adapters.editor({ ...identity });
    expect(returned).toBe(first);
    const last = returned.layouts!.write('People', { Person: { x: 9, y: 9 } });
    await Promise.resolve();
    expect(requests).toHaveLength(1);
    complete();
    expect(await saved).toBe(true);
    expect(await last).toBe(true);
    expect(JSON.parse(JSON.parse(requests[1].data).value).nodes).toEqual({ Person: { x: 9, y: 9 } });
  });

  it('cancels old queued operations and refuses calls through a service from the previous session', async () => {
    const adapters = new StudioServerAdapters();
    let complete!: () => void;
    const requests: InternalAxiosRequestConfig[] = [];
    backgroundFetcher.defaults.adapter = (config) => {
      requests.push(config);
      if (requests.length === 1)
        return new Promise((resolve) => {
          complete = () => resolve(reply(config, { code: 0 }));
        });
      return Promise.resolve(reply(config, { code: 0 }));
    };
    const previous = adapters.editor(identity);
    const first = previous.layouts!.write('People', layout);
    const firstFailure = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    const queued = previous.layouts!.write('People', layout);
    const queuedFailure = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    sessionRequests.reset();
    complete();
    await Promise.all([firstFailure, queuedFailure]);
    expect(requests).toHaveLength(1);
    await expect(previous.layouts!.write('People', layout)).rejects.toMatchObject({ name: 'AbortError' });
    const current = adapters.editor(identity);
    expect(current).not.toBe(previous);
    expect(await current.layouts!.write('People', layout)).toBe(true);
  });

  it('keeps identity fixed for delayed writes and separates Schema scopes', async () => {
    const adapters = new StudioServerAdapters();
    const requests: InternalAxiosRequestConfig[] = [];
    backgroundFetcher.defaults.adapter = async (config) => {
      requests.push(config);
      return reply(config, { code: 0 });
    };
    const mutable = { ...identity };
    const previous = adapters.editor(mutable);
    mutable.schemaPath = '/other';
    const current = adapters.editor(mutable);
    await previous.layouts!.write('People', layout);
    await current.layouts!.write('People', layout);
    expect(JSON.parse(JSON.parse(requests[0].data).value).schemaPath).toBe('/demo');
    expect(JSON.parse(JSON.parse(requests[1].data).value).schemaPath).toBe('/other');
  });

  it('resolves the current identity when a long-lived Schema controller invokes an operation', async () => {
    const adapters = new StudioServerAdapters();
    const current: { user?: typeof identity } = {};
    const services = createSchemaServices(() => current.user, adapters);
    const requests: InternalAxiosRequestConfig[] = [];
    backgroundFetcher.defaults.adapter = async (config) => {
      requests.push(config);
      return reply(config, { code: 0, data: { total: 0, items: [] } });
    };
    await services.sweepLayouts!('/demo', ['People']);
    expect(requests).toHaveLength(0);
    current.user = { ...identity };
    await services.sweepLayouts!('/demo', ['People']);
    expect(requests).toHaveLength(1);
  });
});

describe('Studio host transport policies', () => {
  it('preserves per-query suppression and message filtering', async () => {
    fetcher.defaults.adapter = async (config) => {
      throw Object.assign(new Error('failed'), {
        config,
        response: { ...reply(config, { code: 42, message: '[NJ009]: not collected' }), status: 500 },
      });
    };
    const schema = new StudioServerAdapters().schema(identity);
    await schema.execute('SHOW STATS', { errTip: true, errMsgInterceptor: () => null });
    expect(modalStore.message.error).not.toHaveBeenCalled();
    await schema.execute('CREATE GRAPH TYPE', { errTip: false });
    expect(modalStore.message.error).not.toHaveBeenCalled();
    await schema.execute('SHOW STATS', { errTip: true });
    expect(modalStore.message.error).toHaveBeenCalledOnce();
  });

  it('keeps optional reads and layout saves silent while settings saves retain their failure', async () => {
    const fail = async (config: InternalAxiosRequestConfig) => {
      throw Object.assign(new Error('failed'), {
        config,
        response: { ...reply(config, { code: 42, message: 'disabled' }), status: 500 },
      });
    };
    fetcher.defaults.adapter = fail;
    backgroundFetcher.defaults.adapter = fail;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = new StudioServerAdapters().editor(identity);
    expect(await editor.layouts!.write('People', layout)).toBe(false);
    expect(await editor.layouts!.read('People')).toBeNull();
    const explorer = createExplorerServices();
    const settings = await explorer.settings!.load();
    expect(settings.appConfigForm?.queryTimeout).toBe(120);
    expect(modalStore.message.error).not.toHaveBeenCalled();
    await expect(
      explorer.settings!.save(settings as Parameters<NonNullable<typeof explorer.settings>['save']>[0])
    ).rejects.toThrow('disabled');
    expect(modalStore.message.error).toHaveBeenCalledOnce();
  });

  it('retains the host response parser for large integers', async () => {
    fetcher.defaults.adapter = async (config) => ({
      ...reply(config, null),
      data: '{"code":0,"data":{"value":9223372036854775807}}',
    });
    const result = await execConsoleGql<{ value: { toString(): string } }>('RETURN 9223372036854775807');
    expect(result.data?.value.toString()).toBe('9223372036854775807');
  });
});
