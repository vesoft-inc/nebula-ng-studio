import { createFileRoute } from '@tanstack/react-router';
import { GraphInfo } from '@vesoft-inc/studio-ui-internal/schema';
export const Route = createFileRoute('/_app/_schema/schema-manager/graphs/$graphName')({
  staticData: { schemaSelection: 'graph' },
  component: Page,
});
function Page() {
  const { graphName } = Route.useParams();
  const navigate = Route.useNavigate();
  return (
    <GraphInfo key={graphName} graphName={graphName} onBack={() => void navigate({ to: '/schema-manager/graphs' })} />
  );
}
