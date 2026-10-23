import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import SchemaTree, { generateTreeNodeKey } from './SchemaTree';
import type { TreeNode } from '../shared/LazyTree';
import type { ISchemaTreeRawData } from './types';
import { SchemaItemType } from '../shared/constants';
import { useSchema } from './context';
import { useModal } from '../shared/useModal';
import type { SchemaView } from './SchemaWorkbench';

export interface SchemaSidebarProps {
  view?: SchemaView;
  onNavigate: (view: SchemaView) => void;
  onSchemaChange?: (path: string) => void;
  showDetail?: boolean;
  collapsed?: boolean;
}

export const SchemaSidebar = observer(function SchemaSidebar({
  view,
  onNavigate,
  onSchemaChange,
  showDetail = false,
  collapsed = false,
}: SchemaSidebarProps) {
  const controller = useSchema();
  const { t } = useTranslation('common');
  const { message } = useModal();
  const load = async ({ rawData }: TreeNode<ISchemaTreeRawData>) => {
    if (rawData?.type === SchemaItemType.GraphType) await controller.updateGraphTypesBySchema();
    if (rawData?.type === SchemaItemType.Graph) await controller.updateGraphsBySchema();
    if (showDetail && rawData?.type === SchemaItemType.GraphTypeDescItem && rawData.graphType)
      await controller.updateGraphTypeDetailBySchema(rawData.graphType.graph_type);
    if (showDetail && rawData?.type === SchemaItemType.EntityTypeDescItem && rawData.entity)
      await controller.updateEntityTypeDescsBySchema(rawData.entity.graph_type_name, rawData.entity.type_name);
  };
  const selectedKey =
    view?.type === 'graph'
      ? generateTreeNodeKey(SchemaItemType.GraphDescItem, { graphName: view.name })
      : view?.type === 'graphs'
        ? generateTreeNodeKey(SchemaItemType.Graph, {})
        : view?.type === 'editor' && view.graphTypeName
          ? generateTreeNodeKey(SchemaItemType.GraphTypeDescItem, { graphTypeName: view.graphTypeName })
          : generateTreeNodeKey(SchemaItemType.GraphType, {});
  return (
    <SchemaTree
      schema={controller.currentSchema}
      showDetail={showDetail}
      selectedKeys={[selectedKey]}
      onLoadNode={load}
      onCreateGraphType={() => onNavigate({ type: 'editor', mode: 'create' })}
      onCreateGraph={() => controller.updateCreateGraphModalInfo({ visible: true })}
      onItemSelected={({ rawData }) => {
        if (rawData?.type === SchemaItemType.Graph) onNavigate({ type: 'graphs' });
        if (rawData?.type === SchemaItemType.GraphType) onNavigate({ type: 'graph-types' });
        if (rawData?.type === SchemaItemType.GraphDescItem && rawData.graph)
          onNavigate({ type: 'graph', name: rawData.graph.graph });
        if (rawData?.type === SchemaItemType.GraphTypeDescItem && rawData.graphType)
          onNavigate({ type: 'editor', mode: 'readonly', graphTypeName: rawData.graphType.graph_type });
      }}
      selector={{
        schemas: controller.schemas,
        schemaLabel: controller.currentSchema.path.split('/').pop(),
        collapsed,
        onSwitchSchema: async (schema) => {
          const result = await controller.switchSchema(schema.path);
          if (result.code !== 0) return false;
          onNavigate({ type: 'graph-types' });
          onSchemaChange?.(schema.path);
          message.success(t('switchSchemaSuccess'));
          return true;
        },
        onCreateSchema: async (path) => {
          const result = await controller.createSchema(path);
          if (result.code !== 0) return false;
          await controller.getSchemas();
          onNavigate({ type: 'schemas' });
          return true;
        },
        onViewAllSchemas: () => onNavigate({ type: 'schemas' }),
      }}
    />
  );
});
