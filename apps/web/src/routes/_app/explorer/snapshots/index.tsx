import { createFileRoute } from '@tanstack/react-router';
import { SnapshotList } from '@vesoft-inc/studio-ui-internal/explorer';
export const Route = createFileRoute('/_app/explorer/snapshots/')({ component: Page });
function Page() {
  const navigate = Route.useNavigate();
  return (
    <SnapshotList
      onOpen={(snapshotId) => void navigate({ to: '/explorer/snapshots/$snapshotId', params: { snapshotId } })}
    />
  );
}
