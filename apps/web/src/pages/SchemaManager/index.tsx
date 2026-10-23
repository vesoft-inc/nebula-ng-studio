import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from 'react-router-dom';
import { SchemaWorkbench, type SchemaView } from '@vesoft-inc/ui-components/schema';
import { commonStore, schemaStore } from '@studio/stores/session';
import { createSchemaEditorServices } from '@studio/services/schemaEditor';
import { resolveSchemaPath } from '@studio/services/schemaLayout';
import { encodeUrl } from '@studio/utils';

function pathToView(pathname: string): SchemaView {
  const [, page, section, action, name] = pathname.split('/').map(decodeURIComponent);
  if (page === 'schema-list') return { type: 'schemas' };
  if (section === 'graphs') return action ? { type: 'graph', name: action } : { type: 'graphs' };
  if (action === 'sketch')
    return name ? { type: 'editor', mode: 'sketch', sketchId: Number(name) } : { type: 'sketches' };
  if (action === 'create') return { type: 'editor', mode: 'create' };
  if ((action === 'edit' || action === 'view') && name)
    return { type: 'editor', mode: action === 'view' ? 'readonly' : 'edit', graphTypeName: name };
  return { type: 'graph-types' };
}
function viewToPath(view: SchemaView): string {
  switch (view.type) {
    case 'schemas':
      return '/schema-list';
    case 'graphs':
      return '/schema-manager/graphs';
    case 'graph':
      return `/schema-manager/graphs/${encodeUrl(view.name)}`;
    case 'sketches':
      return '/schema-manager/graphtype/sketch';
    case 'editor':
      return view.mode === 'create'
        ? '/schema-manager/graphtype/create'
        : view.mode === 'sketch'
          ? `/schema-manager/graphtype/sketch/${view.sketchId}`
          : `/schema-manager/graphtype/${view.mode === 'readonly' ? 'view' : 'edit'}/${encodeUrl(view.graphTypeName ?? '')}`;
    default:
      return '/schema-manager/graphtype';
  }
}

export default observer(function SchemaManager() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { address, username, curSchemaPath } = commonStore.userInfo ?? {};
  const schemaPath = resolveSchemaPath(curSchemaPath, schemaStore.currentSchema.path);
  const editorServices = useMemo(
    () => createSchemaEditorServices({ address, username, schemaPath }),
    [address, username, schemaPath]
  );
  return (
    <SchemaWorkbench
      controller={schemaStore}
      services={schemaStore.services}
      editorServices={editorServices}
      view={pathToView(pathname)}
      onViewChange={(view) => navigate(viewToPath(view))}
      onSchemaChange={(path) => {
        if (commonStore.userInfo) commonStore.setUserInfo({ ...commonStore.userInfo, curSchemaPath: path });
      }}
    />
  );
});
