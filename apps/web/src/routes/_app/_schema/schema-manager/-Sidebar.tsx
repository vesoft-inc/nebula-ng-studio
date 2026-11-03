import { observer } from 'mobx-react-lite';
import { useMatches, useNavigate } from '@tanstack/react-router';
import { SchemaTree, generateTreeNodeKey, useSchemaTreeBindings } from '@vesoft-inc/studio-ui-internal/schema';
import { SchemaItemType } from '@vesoft-inc/studio-ui-internal/utilities';
import { commonStore, schemaStore } from '@studio/app/session';
import { routePaths } from '@studio/app/paths';

export default observer(function SchemaSidebar() {
  const navigate = useNavigate();
  const match = useMatches().at(-1);
  const handle = match?.staticData;
  const params = match?.params as { graphName?: string; graphTypeName?: string } | undefined;
  const name = params?.graphName ?? params?.graphTypeName;
  const selectedKey =
    handle?.schemaSelection === 'graph' && name
      ? generateTreeNodeKey(SchemaItemType.GraphDescItem, { graphName: name })
      : handle?.schemaSelection === 'graphs'
        ? generateTreeNodeKey(SchemaItemType.Graph, {})
        : handle?.schemaSelection === 'graph-type' && name
          ? generateTreeNodeKey(SchemaItemType.GraphTypeDescItem, { graphTypeName: name })
          : generateTreeNodeKey(SchemaItemType.GraphType, {});
  const bindings = useSchemaTreeBindings({
    controller: schemaStore,
    showDetail: false,
    onSchemaChange: (path) => {
      navigate({ to: routePaths.schema.graphTypes });
      commonStore.setSchemaPath(path);
    },
    onSchemaCreated: () => navigate({ to: routePaths.schema.schemas }),
    onCreateGraphType: () => navigate({ to: routePaths.schema.createGraphType }),
    onViewAllSchemas: () => navigate({ to: routePaths.schema.schemas }),
  });
  return (
    <SchemaTree
      {...bindings}
      selectedKeys={[selectedKey]}
      onItemSelected={({ rawData }) => {
        if (rawData?.type === SchemaItemType.Graph) navigate({ to: routePaths.schema.graphs });
        if (rawData?.type === SchemaItemType.GraphType) navigate({ to: routePaths.schema.graphTypes });
        if (rawData?.type === SchemaItemType.GraphDescItem && rawData.graph)
          navigate({ to: '/schema-manager/graphs/$graphName', params: { graphName: rawData.graph.graph } });
        if (rawData?.type === SchemaItemType.GraphTypeDescItem && rawData.graphType)
          navigate({
            to: '/schema-manager/graphtype/view/$graphTypeName',
            params: { graphTypeName: rawData.graphType.graph_type },
          });
      }}
    />
  );
});
