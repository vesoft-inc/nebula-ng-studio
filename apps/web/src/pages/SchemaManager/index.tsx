import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SchemaWorkbench } from '@vesoft-inc/ui-components/schema';
import { commonStore, schemaStore } from '@studio/app/session';
import { createSchemaEditorServices } from '@studio/services/schemaEditor';
import { resolveSchemaPath } from '@studio/services/schemaLayout';
import { schemaRouteView, schemaViewPath, type SchemaRoute } from '@studio/app/schemaRoutes';

export default observer(function SchemaManager({ route = 'graph-types' }: { route?: SchemaRoute }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { address, username, curSchemaPath } = commonStore.userInfo ?? {};
  const schemaPath = resolveSchemaPath(curSchemaPath, schemaStore.currentSchema.path);
  const editorServices = useMemo(
    () => createSchemaEditorServices({ address, username, schemaPath }),
    [address, username, schemaPath]
  );
  const view = schemaRouteView(route, pathname);
  if (!view) return <Navigate replace to="/schema-manager/graphtype" />;
  return (
    <SchemaWorkbench
      controller={schemaStore}
      services={schemaStore.services}
      editorServices={editorServices}
      view={view}
      onViewChange={(view) => navigate(schemaViewPath(view))}
      onSchemaChange={commonStore.setSchemaPath}
    />
  );
});
