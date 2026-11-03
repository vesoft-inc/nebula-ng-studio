import { createFileRoute } from '@tanstack/react-router';
import { SchemaList } from '@vesoft-inc/studio-ui-internal/schema';
import { commonStore } from '@studio/app/session';
export const Route = createFileRoute('/_app/_schema/schema-list')({ component: Page });
function Page() {
  const navigate = Route.useNavigate();
  return (
    <SchemaList
      onOpen={(schema) => {
        commonStore.setSchemaPath(schema.path);
        void navigate({ to: '/schema-manager/graphtype' });
      }}
      onSchemaChange={commonStore.setSchemaPath}
    />
  );
}
