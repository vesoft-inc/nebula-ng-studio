import {
  ensureExplorerSnapshot,
  type ConsoleExplorerOptions,
} from '@vesoft-inc/studio-ui-internal/integrations/console-explorer';
import { backgroundSnapshotServices } from '@studio/services/explorer';
import { inSession, sessionRequests } from '@studio/services/sessionRequests';
import { explorerSnapshotPath } from '@studio/app/paths';

type ExploreResultArgs = Omit<ConsoleExplorerOptions, 'snapshots' | 'snapshotVersion'> & {
  navigate: (to: string) => void;
  notifyError: (message: string) => void;
  exploreFailedMessage: string;
};

export async function exploreConsoleResult({
  navigate,
  notifyError,
  exploreFailedMessage,
  ...options
}: ExploreResultArgs) {
  const signal = sessionRequests.signal;
  try {
    const snapshot = await inSession(signal, { signal: options.signal }, (request) =>
      ensureExplorerSnapshot({
        ...options,
        signal: request.signal,
        snapshots: {
          read: (id) => backgroundSnapshotServices.read(id, request),
          create: (payload) => backgroundSnapshotServices.create(payload, request),
        },
        snapshotVersion: process.env.VERSION,
      })
    );
    if (snapshot) {
      if (signal.aborted || options.signal?.aborted) return;
      navigate(explorerSnapshotPath(snapshot.snapshotId));
    }
  } catch (error) {
    if (signal.aborted || options.signal?.aborted) return;
    notifyError(error instanceof Error && error.message ? error.message : exploreFailedMessage);
  }
}
