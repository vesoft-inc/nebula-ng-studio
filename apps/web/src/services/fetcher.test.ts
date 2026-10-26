// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { ConsoleController } from '@vesoft-inc/ui-components/console/model';
import { HttpResCode } from '@vesoft-inc/utils';
import { fetcher } from './fetcher';
import { execConsoleGql } from './nebula';

const originalAdapter = fetcher.instance.defaults.adapter;
let controller: ConsoleController | undefined;
afterEach(() => {
  controller?.destroy();
  fetcher.instance.defaults.adapter = originalAdapter;
  vi.useRealTimers();
});

it.each([
  ['ERR_NETWORK', 'Network Error'],
  ['ECONNABORTED', 'timeout of 1000ms exceeded'],
])('reports %s and unlocks the Console editor', async (code, message) => {
  vi.useFakeTimers();
  fetcher.instance.defaults.adapter = async (config) => {
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
});
