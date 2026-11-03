import { createFileRoute } from '@tanstack/react-router';
import { SnapshotPage } from './-Snapshot';
export const Route = createFileRoute('/_app/explorer/snapshots/$snapshotId')({ component: Page });
function Page() {
  return <SnapshotPage snapshotId={Route.useParams().snapshotId} />;
}
