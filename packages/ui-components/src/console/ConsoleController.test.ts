import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerResponse } from '@vesoft-inc/utils';
import ConsoleController from './ConsoleController';
import type { QueryExecutor } from '../shared/query';
import type { GraphWorkspaceStore } from '../graph/stores/workspace';

const response = (tables: object[] = [], code = 0) => ({ code, message: '', data: { tables } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const executor = (fn = vi.fn(async (_gql: string) => response())) => fn as unknown as QueryExecutor;

describe('ConsoleController lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps execution, editor state and result resources independent between instances', async () => {
    const executeA = vi.fn(async (_gql: string) => response());
    const executeB = vi.fn(async (_gql: string) => response());
    const a = new ConsoleController({ execute: executor(executeA), query: executor() });
    const b = new ConsoleController({ execute: executor(executeB), query: executor() });
    a.updateEditorValue('RETURN 1');
    b.updateEditorValue('RETURN 2');
    const runs = [a.runGql(a.editorValue), b.runGql(b.editorValue)];
    await vi.runAllTimersAsync();
    await Promise.all(runs);
    expect(a.results[0].gql).toBe('RETURN 1');
    expect(b.results[0].gql).toBe('RETURN 2');
    expect(executeA.mock.calls[0][0]).toBe('profile format="verbose" RETURN 1');
    const destroy = vi.fn();
    a.graphWorkspaces.set(a.results[0].id, { destroy } as unknown as GraphWorkspaceStore);
    a.results[0].destroy();
    expect(destroy).toHaveBeenCalledOnce();
    expect(a.results).toHaveLength(0);
    expect(b.results).toHaveLength(1);
    expect(b.editorRunning).toBe(false);
    a.destroy();
    b.destroy();
  });

  it('does not insert delayed results or clear a new draft after clear or destroy', async () => {
    const execute = vi.fn(async (_gql: string) => response());
    const controller = new ConsoleController({ execute: executor(execute), query: executor() });
    const run = controller.runGql('RETURN 1');
    await vi.advanceTimersByTimeAsync(1);
    controller.destroy();
    controller.updateEditorValue('new draft');
    await vi.runAllTimersAsync();
    await run;
    expect(controller.results).toHaveLength(0);
    expect(controller.editorValue).toBe('new draft');
    expect(controller.editorRef).toBeUndefined();
    expect(controller.editorRunning).toBe(false);
  });

  it.each([undefined, null])('records errors without a message (%s) and allows the next query', async (message) => {
    const execute = vi.fn().mockResolvedValue(response()).mockResolvedValueOnce({ code: 1, message });
    const controller = new ConsoleController({ execute: execute as QueryExecutor, query: executor() });
    controller.updateEditorValue('RETURN 1');
    const failed = controller.runGql(controller.editorValue);
    await vi.runAllTimersAsync();
    await failed;

    expect(controller.editorRunning).toBe(false);
    expect(controller.editorValue).toBe('RETURN 1');
    expect(controller.results[0]).toMatchObject({ code: 1, message: '' });

    const retry = controller.runGql(controller.editorValue);
    await vi.runAllTimersAsync();
    await retry;
    expect(controller.results).toHaveLength(2);
    expect(controller.results[0].code).toBe(0);
    expect(controller.editorValue).toBe('');
    controller.destroy();
  });

  it('releases the running state when processing a delayed result throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const execute = vi.fn().mockResolvedValue(response()).mockResolvedValueOnce({ code: 1, message: 42 });
    const controller = new ConsoleController({ execute: execute as QueryExecutor, query: executor() });
    try {
      const run = controller.runGql('RETURN 1');
      await vi.runAllTimersAsync();
      await run;
      expect(controller.editorRunning).toBe(false);
      expect(error).toHaveBeenCalledWith('error', expect.any(TypeError));
    } finally {
      error.mockRestore();
      controller.destroy();
    }
  });

  it('ignores a cancelled response even when the adapter resolves after a new run', async () => {
    const pending = deferred<ServerResponse<object>>();
    const execute = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(response());
    const cancelQuery = vi.fn(async () => undefined);
    const controller = new ConsoleController({
      execute: execute as QueryExecutor,
      query: executor(),
      getSessionId: async () => 'session-1',
      cancelQuery,
    });
    const first = controller.runGql('RETURN 1');
    await vi.advanceTimersByTimeAsync(0);
    const signal = execute.mock.calls[0][1].signal as AbortSignal;
    await controller.cancelQuery();
    expect(signal.aborted).toBe(true);
    expect(cancelQuery).toHaveBeenCalledWith('session-1');
    const second = controller.runGql('RETURN 2');
    pending.resolve(response());
    await first;
    expect(controller.editorRunning).toBe(true);
    await vi.runAllTimersAsync();
    await second;
    expect(controller.results.map((item) => item.gql)).toEqual(['RETURN 2']);
    expect(execute.mock.calls.filter(([gql]) => gql === 'SHOW WARNINGS')).toHaveLength(1);
  });

  it('aborts metadata and refuses stale graph lists and graph types after clearing a session', async () => {
    const graphList = deferred<ServerResponse<object>>();
    const graphTypes = deferred<ServerResponse<object>>();
    const query = vi.fn().mockReturnValueOnce(graphList.promise).mockReturnValueOnce(graphTypes.promise);
    const controller = new ConsoleController({ execute: executor(), query: query as QueryExecutor });
    const list = controller.getGraphs();
    const types = controller.updateGraphTypeMap(['old-graph', 'never-requested']);
    controller.clearConsole();
    expect(query.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);
    graphList.resolve(response([{ graph: 'old-graph' }]));
    graphTypes.resolve(response([{ graph_type_name: 'old-type' }]));
    await Promise.all([list, types]);
    expect(controller.graphs).toEqual([]);
    expect(controller.graphTypeInfo.size).toBe(0);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('stops subsequent sections on error and keeps warnings attached to that result', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(response([], 1))
      .mockResolvedValueOnce(response([{ message: 'warning' }]));
    const controller = new ConsoleController({ execute: execute as QueryExecutor, query: executor() });
    controller.updateEditorValue('RETURN broken\nRETURN 2');
    const run = controller.runGql(controller.editorValue);
    await vi.runAllTimersAsync();
    await run;
    expect(execute).toHaveBeenCalledTimes(2);
    expect(controller.results[0].warnings).toEqual([{ message: 'warning' }]);
    expect(controller.editorValue).toBe('RETURN broken\nRETURN 2');
  });
});
