import { useNavigate } from 'react-router-dom';
import { useSchemaTreeBindings as useSharedSchemaTreeBindings } from '@vesoft-inc/ui-components/schema';
import { commonStore, schemaStore } from '@studio/app/session';
import { isGuiTarget } from '@studio/utils';

export function useSchemaTreeBindings(showDetail: boolean) {
  const navigate = useNavigate();
  const bindings = useSharedSchemaTreeBindings({
    controller: schemaStore,
    showDetail,
    collapsed: isGuiTarget,
    schemaLabel: commonStore.userInfo?.curSchemaPath.split('/').pop(),
    onSchemaChange: commonStore.setSchemaPath,
    onSchemaCreated: () => navigate('/schema-list'),
    onCreateGraphType: () => navigate('/schema-manager/graphtype/create'),
    onViewAllSchemas: () => navigate('/schema-list'),
  });
  return {
    ...bindings,
    onReady: () => {
      void schemaStore.getSchemas();
    },
  };
}
