import { useNavigate } from '@tanstack/react-router';
import { useSchemaTreeBindings as useSharedSchemaTreeBindings } from '@vesoft-inc/studio-ui-internal/schema';
import { commonStore, schemaStore } from '@studio/app/session';
import { isGuiTarget } from '@studio/utils';
import { routePaths } from '@studio/app/paths';

export function useSchemaTreeBindings(showDetail: boolean) {
  const navigate = useNavigate();
  const bindings = useSharedSchemaTreeBindings({
    controller: schemaStore,
    showDetail,
    collapsed: isGuiTarget,
    schemaLabel: commonStore.userInfo?.curSchemaPath.split('/').pop(),
    onSchemaChange: commonStore.setSchemaPath,
    onSchemaCreated: () => navigate({ to: routePaths.schema.schemas }),
    onCreateGraphType: () => navigate({ to: routePaths.schema.createGraphType }),
    onViewAllSchemas: () => navigate({ to: routePaths.schema.schemas }),
  });
  return {
    ...bindings,
    onReady: () => {
      void schemaStore.getSchemas();
    },
  };
}
