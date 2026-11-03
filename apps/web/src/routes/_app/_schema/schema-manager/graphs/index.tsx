import { createFileRoute } from '@tanstack/react-router';
import { GraphList } from '@vesoft-inc/studio-ui-internal/schema';
import { schemaStore } from '@studio/app/session';
export const Route = createFileRoute('/_app/_schema/schema-manager/graphs/')({
  staticData: { schemaSelection: 'graphs' },
  component: Page,
});
function Page() {
  const navigate = Route.useNavigate();
  return (
    <GraphList
      onView={(graphName) => void navigate({ to: '/schema-manager/graphs/$graphName', params: { graphName } })}
      onCreate={() => schemaStore.updateCreateGraphModalInfo({ visible: true })}
    />
  );
}
