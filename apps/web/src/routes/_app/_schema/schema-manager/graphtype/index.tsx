import { createFileRoute } from '@tanstack/react-router';
import { GraphTypeList } from '@vesoft-inc/studio-ui-internal/schema';
import { useSchemaEditorServices } from '../../-context';
export const Route = createFileRoute('/_app/_schema/schema-manager/graphtype/')({ component: Page });
function Page() {
  const navigate = Route.useNavigate();
  const services = useSchemaEditorServices();
  return (
    <GraphTypeList
      sketches={services.sketches}
      onCreate={() => void navigate({ to: '/schema-manager/graphtype/create' })}
      onView={(graphTypeName) =>
        void navigate({ to: '/schema-manager/graphtype/view/$graphTypeName', params: { graphTypeName } })
      }
      onEdit={(graphTypeName) =>
        void navigate({ to: '/schema-manager/graphtype/edit/$graphTypeName', params: { graphTypeName } })
      }
      onSketches={() => void navigate({ to: '/schema-manager/graphtype/sketch' })}
    />
  );
}
