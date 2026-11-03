import { beforeEach, expect, it, vi } from 'vitest';
import { ensureExplorerSnapshot } from '@vesoft-inc/studio-ui-internal/integrations/console-explorer';
import { backgroundSnapshotServices } from '@studio/services/explorer';
import { exploreConsoleResult } from './-exploreResult';
import { sessionRequests } from '@studio/services/sessionRequests';

vi.mock('@vesoft-inc/studio-ui-internal/integrations/console-explorer', () => ({ ensureExplorerSnapshot: vi.fn() }));
vi.mock('@studio/services/explorer', () => ({ backgroundSnapshotServices: { create: vi.fn(), read: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

function options() {
  return {
    result: { id: 'result-1', gql: 'RETURN 1' },
    graph: 'people',
    consoleController: {} as Parameters<typeof exploreConsoleResult>[0]['consoleController'],
    schemaController: {} as Parameters<typeof exploreConsoleResult>[0]['schemaController'],
    schemaPathFallback: '/session-schema',
    navigate: vi.fn(),
    notifyError: vi.fn(),
    exploreFailedMessage: '无法打开探索结果',
  };
}

it('injects Studio snapshot services and navigates with an encoded snapshot ID', async () => {
  const args = options();
  vi.mocked(ensureExplorerSnapshot).mockImplementationOnce(async (input) => {
    expect(input).toMatchObject({
      result: args.result,
      graph: args.graph,
      consoleController: args.consoleController,
      schemaController: args.schemaController,
      schemaPathFallback: '/session-schema',
      snapshotVersion: process.env.VERSION,
    });
    await input.snapshots.read('previous');
    await input.snapshots.create({
      name: 'Console result',
      graph: 'people',
      graph_type: 'Person',
      schema_path: '/demo',
    });
    return { snapshotId: 'snapshot/with space' };
  });

  await exploreConsoleResult(args);
  expect(backgroundSnapshotServices.read).toHaveBeenCalledWith(
    'previous',
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
  expect(backgroundSnapshotServices.create).toHaveBeenCalledWith(
    expect.objectContaining({ graph: 'people' }),
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
  expect(args.navigate).toHaveBeenCalledOnce();
  expect(args.navigate).toHaveBeenCalledWith('/explorer/snapshots/snapshot%2Fwith%20space');
  expect(args.notifyError).not.toHaveBeenCalled();
});

it('keeps the current page when no result can be explored', async () => {
  const args = options();
  vi.mocked(ensureExplorerSnapshot).mockResolvedValueOnce(null);
  await exploreConsoleResult(args);
  expect(args.navigate).not.toHaveBeenCalled();
  expect(args.notifyError).not.toHaveBeenCalled();
});

it('cancels the whole handoff on session expiry and suppresses its late navigation and error', async () => {
  const args = options();
  let complete!: (value: { snapshotId: string }) => void;
  let signal: AbortSignal | undefined;
  vi.mocked(ensureExplorerSnapshot).mockImplementationOnce((input) => {
    signal = input.signal;
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  const opening = exploreConsoleResult(args);
  expect(signal?.aborted).toBe(false);
  sessionRequests.reset();
  expect(signal?.aborted).toBe(true);
  complete({ snapshotId: 'late' });
  await opening;
  expect(args.navigate).not.toHaveBeenCalled();
  expect(args.notifyError).not.toHaveBeenCalled();
});

it.each([new Error('service failed'), new Error()])(
  'presents one error and does not navigate on failure: %s',
  async (error) => {
    const args = options();
    vi.mocked(ensureExplorerSnapshot).mockRejectedValueOnce(error);
    await exploreConsoleResult(args);
    expect(args.notifyError).toHaveBeenCalledOnce();
    expect(args.notifyError).toHaveBeenCalledWith(error.message || args.exploreFailedMessage);
    expect(args.navigate).not.toHaveBeenCalled();
  }
);
