import {
  ensureExplorerSnapshot,
  type ConsoleExplorerOptions,
} from '@vesoft-inc/studio-ui-internal/integrations/console-explorer';
import { addSnapshot, getSnapshotDetail } from '@studio/services/explorer';
import { explorerSnapshotPath } from '@studio/app/paths';

type ExploreResultArgs = Omit<ConsoleExplorerOptions, 'snapshots' | 'snapshotVersion'> & {
  navigate: (to: string) => void;
  notifyError: (message: string) => void;
  exploreFailedMessage: string;
};

const snapshots: ConsoleExplorerOptions['snapshots'] = {
  read: (id) => getSnapshotDetail(id, { errTip: false }),
  create: (payload) => addSnapshot(payload, { errTip: false }),
};

export async function exploreConsoleResult({
  navigate,
  notifyError,
  exploreFailedMessage,
  ...options
}: ExploreResultArgs) {
  try {
    const snapshot = await ensureExplorerSnapshot({
      ...options,
      snapshots,
      snapshotVersion: process.env.VERSION,
    });
    if (snapshot) {
      navigate(explorerSnapshotPath(snapshot.snapshotId));
    }
  } catch (error) {
    notifyError(error instanceof Error && error.message ? error.message : exploreFailedMessage);
  }
}
