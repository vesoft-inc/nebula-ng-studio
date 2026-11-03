import { createFileRoute } from '@tanstack/react-router';
import { SketchList } from '@vesoft-inc/studio-ui-internal/schema-editor';
export const Route = createFileRoute('/_app/_schema/schema-manager/graphtype/sketch/')({ component: Page });
function Page() {
  const navigate = Route.useNavigate();
  return (
    <SketchList
      onOpen={(sketchId) =>
        void navigate({ to: '/schema-manager/graphtype/sketch/$sketchId', params: { sketchId: String(sketchId) } })
      }
    />
  );
}
