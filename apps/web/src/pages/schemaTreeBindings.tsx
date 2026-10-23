import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useModal } from '@studio/stores/useModal';
import { commonStore, schemaStore } from '@studio/stores/session';
import type { TreeNode } from '@studio/components/LazyTree';
import type { ISchemaItem, ISchemaTreeRawData } from '@studio/interfaces';
import { SchemaItemType } from '@studio/utils/constant';
import { isGuiTarget } from '@studio/utils';

export async function loadSchemaTreeNode(node: TreeNode<ISchemaTreeRawData>, showDetail: boolean) {
  const { rawData } = node;
  const { type } = rawData as { type: SchemaItemType };
  switch (type) {
    case SchemaItemType.GraphType:
      await schemaStore.updateGraphTypesBySchema();
      break;
    case SchemaItemType.GraphTypeDescItem: {
      if (showDetail && rawData?.graphType) {
        await schemaStore.updateGraphTypeDetailBySchema(rawData.graphType.graph_type);
      }
      break;
    }
    case SchemaItemType.EntityTypeDescItem: {
      if (showDetail && rawData?.entity) {
        await schemaStore.updateEntityTypeDescsBySchema(rawData.entity.graph_type_name, rawData.entity.type_name);
      }
      break;
    }
    case SchemaItemType.Graph:
      await schemaStore.updateGraphsBySchema();
      break;
    default:
      break;
  }
}

export function useSchemaTreeBindings(showDetail: boolean) {
  const navigate = useNavigate();
  const { message } = useModal();
  const { t } = useTranslation(['common']);
  const { currentSchema, schemas } = schemaStore;

  return {
    schema: currentSchema,
    onReady: () => {
      schemaStore.getSchemas();
    },
    onLoadNode: (node: TreeNode<ISchemaTreeRawData>) => loadSchemaTreeNode(node, showDetail),
    onCreateGraphType: () => navigate('/schema-manager/graphtype/create'),
    onCreateGraph: () => schemaStore.updateCreateGraphModalInfo({ visible: true }),
    selector: {
      schemaLabel: commonStore.userInfo?.curSchemaPath.split('/').pop(),
      schemas,
      collapsed: isGuiTarget,
      switching: schemaStore.switchingSchema,
      onSwitchSchema: async (schema: ISchemaItem) => {
        const res = await schemaStore.switchSchema(schema.path);
        if (res.code !== 0) return false;
        commonStore.setSchemaPath(schema.path);
        message.success(t('switchSchemaSuccess', { ns: 'common' }));
        return true;
      },
      onCreateSchema: async (path: string) => {
        const res = await schemaStore.createSchema(path);
        if (res.code !== 0) return false;
        schemaStore.getSchemas();
        navigate('/schema-list');
        return true;
      },
      onViewAllSchemas: () => navigate('/schema-list'),
    },
  };
}
