import { observer } from 'mobx-react-lite';
import SchemaTree, { generateTreeNodeKey } from './SchemaTree';
import { SchemaItemType } from '../shared/constants';
import { useSchema } from './context';
import { useSchemaTreeBindings } from './useSchemaTreeBindings';
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
  const bindings = useSchemaTreeBindings({
    controller,
    showDetail,
    collapsed,
    onSchemaChange: (path) => {
      onNavigate({ type: 'graph-types' });
      onSchemaChange?.(path);
    },
    onSchemaCreated: () => onNavigate({ type: 'schemas' }),
    onCreateGraphType: () => onNavigate({ type: 'editor', mode: 'create' }),
    onViewAllSchemas: () => onNavigate({ type: 'schemas' }),
  });
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
      {...bindings}
      selectedKeys={[selectedKey]}
      onItemSelected={({ rawData }) => {
        if (rawData?.type === SchemaItemType.Graph) onNavigate({ type: 'graphs' });
        if (rawData?.type === SchemaItemType.GraphType) onNavigate({ type: 'graph-types' });
        if (rawData?.type === SchemaItemType.GraphDescItem && rawData.graph)
          onNavigate({ type: 'graph', name: rawData.graph.graph });
        if (rawData?.type === SchemaItemType.GraphTypeDescItem && rawData.graphType)
          onNavigate({ type: 'editor', mode: 'readonly', graphTypeName: rawData.graphType.graph_type });
      }}
    />
  );
});
