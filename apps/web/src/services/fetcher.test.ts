// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { ConsoleController } from '@vesoft-inc/studio-ui-internal/console/model';
import { HttpResCode, HTTP_CANCEL_CODE } from '@vesoft-inc/studio-core/contracts';
import { modalStore } from '@vesoft-inc/studio-ui-internal/modal';
import { fetcher } from './fetcher';
import { execConsoleGql } from './nebula';

vi.mock('@vesoft-inc/studio-ui-internal/modal', () => ({ modalStore: { message: { error: vi.fn() } } }));

const originalAdapter = fetcher.defaults.adapter;
let controller: ConsoleController | undefined;
afterEach(() => {
  controller?.destroy();
  fetcher.defaults.adapter = originalAdapter;
  vi.useRealTimers();
  vi.clearAllMocks();
});

it.each([
  ['ERR_NETWORK', 'Network Error'],
  ['ECONNABORTED', 'timeout of 1000ms exceeded'],
])('reports %s and unlocks the Console editor', async (code, message) => {
  vi.useFakeTimers();
  fetcher.defaults.adapter = async (config) => {
    throw Object.assign(new Error(message), { code, config });
  };
  controller = new ConsoleController({ execute: execConsoleGql, query: execConsoleGql });
  controller.updateEditorValue('RETURN 1');
  const run = controller.runGql(controller.editorValue);
  await vi.runAllTimersAsync();
  await run;

  expect(controller.results[0]).toMatchObject({ code: HttpResCode.ErrUnknown, message });
  expect(controller.editorValue).toBe('RETURN 1');
  expect(controller.editorRunning).toBe(false);
  expect(modalStore.message?.error).not.toHaveBeenCalled();
});

it('returns cancellation without an error toast', async () => {
  fetcher.defaults.adapter = async (config) => {
    throw Object.assign(new Error('request canceled'), { code: 'ERR_CANCELED', config });
  };

  expect(await execConsoleGql('RETURN 1')).toEqual({ code: HTTP_CANCEL_CODE, message: 'request canceled' });
  expect(modalStore.message?.error).not.toHaveBeenCalled();
});
