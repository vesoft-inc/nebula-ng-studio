import { useBlocker, useNavigate } from '@tanstack/react-router';
import { ExplorerGraph } from '@vesoft-inc/studio-ui-internal/explorer';
import { useState } from 'react';
export function SnapshotPage({ snapshotId }: { snapshotId: string }) {
  const [dirty, setDirty] = useState(false);
  const navigate = useNavigate();
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => dirty && current.pathname !== next.pathname,
    withResolver: true,
    enableBeforeUnload: dirty,
  });
  return (
    <ExplorerGraph
      snapshotId={snapshotId}
      onDirtyChange={setDirty}
      onBack={() => void navigate({ to: '/explorer/snapshots' })}
      blocker={{
        state: blocker.status === 'blocked' ? 'blocked' : 'unblocked',
        proceed: blocker.proceed,
        reset: blocker.reset,
      }}
      allowRemoteIconManagement
    />
  );
}
