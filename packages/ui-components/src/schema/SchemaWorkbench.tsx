import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { observer } from 'mobx-react-lite';
import SchemaController from './SchemaController';
import type { SchemaServices } from './services';
import { SchemaProvider } from './context';
import { SchemaSidebar } from './SchemaSidebar';
import SchemaList from './SchemaList';
import GraphTypeList from './GraphTypeList';
import GraphList from './GraphList';
import GraphInfo from './GraphInfo';
import CreateGraphDialog from './CreateGraphDialog';
import SchemaEditorController from '../schema-editor/SchemaEditorController';
import SchemaEditor from '../schema-editor/Builder';
import SketchList from '../schema-editor/SketchList';
import { GraphTypeStoreProvider } from '../schema-editor/context';
import type { SchemaEditorServices } from '../schema-editor/services';
import { GraphTypeBuildMode } from './types';

export type SchemaView =
  | { type: 'schemas' | 'graph-types' | 'graphs' | 'sketches' }
  | { type: 'graph'; name: string }
  | { type: 'editor'; mode: `${GraphTypeBuildMode}`; graphTypeName?: string; sketchId?: number };

export interface SchemaWorkbenchProps {
  services: SchemaServices;
  editorServices?: SchemaEditorServices;
  controller?: SchemaController;
  view?: SchemaView;
  defaultView?: SchemaView;
  onViewChange?: (view: SchemaView) => void;
  onSchemaChange?: (path: string) => void;
  sidebar?: ReactNode;
}

export function SchemaWorkbenchLayout({ sidebar, children }: { sidebar?: ReactNode; children: ReactNode }) {
  return (
    <Box display="flex" height="100%" sx={{ background: (theme) => theme.palette.vesoft.v2.bg1 }}>
      {sidebar}
      <Box
        position="relative"
        flex={1}
        minWidth={0}
        sx={{ py: 3, overflow: 'auto', background: (theme) => theme.palette.vesoft.v2.bg2 }}
      >
        {children}
      </Box>
    </Box>
  );
}

const SchemaWorkspace = observer(function SchemaWorkspace({
  controller,
  editorServices,
  view,
  navigate,
  onSchemaChange,
  sidebar,
}: {
  controller: SchemaController;
  editorServices: SchemaEditorServices;
  view: SchemaView;
  navigate: (view: SchemaView) => void;
  onSchemaChange?: (path: string) => void;
  sidebar?: ReactNode;
}) {
  const scope = controller.currentSchema.path;
  const editor = useMemo(() => new SchemaEditorController(editorServices), [editorServices, scope]);
  useEffect(() => () => editor.destroy(), [editor]);
  const list = () => navigate({ type: 'graph-types' });
  let content: ReactNode;
  switch (view.type) {
    case 'schemas':
      content = (
        <SchemaList
          onOpen={(schema) => {
            list();
            onSchemaChange?.(schema.path);
          }}
          onSchemaChange={onSchemaChange}
        />
      );
      break;
    case 'graphs':
      content = <GraphList onView={(name) => navigate({ type: 'graph', name })} />;
      break;
    case 'graph':
      content = <GraphInfo key={view.name} graphName={view.name} onBack={() => navigate({ type: 'graphs' })} />;
      break;
    case 'sketches':
      content = <SketchList onOpen={(sketchId) => navigate({ type: 'editor', mode: 'sketch', sketchId })} />;
      break;
    case 'editor':
      content = (
        <SchemaEditor
          mode={view.mode as GraphTypeBuildMode}
          graphTypeName={view.graphTypeName}
          sketchId={view.sketchId}
          onSaved={list}
          onBack={list}
          onEdit={(graphTypeName) => navigate({ type: 'editor', mode: 'edit', graphTypeName })}
          onView={(graphTypeName) => navigate({ type: 'editor', mode: 'readonly', graphTypeName })}
        />
      );
      break;
    default:
      content = (
        <GraphTypeList
          sketches={editorServices.sketches}
          onCreate={() => navigate({ type: 'editor', mode: 'create' })}
          onView={(graphTypeName) => navigate({ type: 'editor', mode: 'readonly', graphTypeName })}
          onEdit={(graphTypeName) => navigate({ type: 'editor', mode: 'edit', graphTypeName })}
          onSketches={() => navigate({ type: 'sketches' })}
        />
      );
  }
  return (
    <SchemaProvider value={controller}>
      <GraphTypeStoreProvider value={editor}>
        {view.type === 'schemas' ? (
          content
        ) : (
          <SchemaWorkbenchLayout
            sidebar={
              sidebar === undefined ? (
                <SchemaSidebar view={view} onNavigate={navigate} onSchemaChange={onSchemaChange} />
              ) : (
                sidebar
              )
            }
          >
            <Box height="100%" key={scope}>
              {content}
            </Box>
          </SchemaWorkbenchLayout>
        )}
        <CreateGraphDialog
          open={controller.createGraphModalInfo.visible}
          graphTypes={controller.currentSchema.graphTypes}
          onCancel={() => controller.updateCreateGraphModalInfo({ visible: false })}
          onCreate={(values) => controller.createGraph(values.graphName, values.graphType)}
          onOk={() => {
            controller.updateCreateGraphModalInfo({ visible: false });
            void controller.updateGraphsBySchema();
            navigate({ type: 'graphs' });
          }}
        />
      </GraphTypeStoreProvider>
    </SchemaProvider>
  );
});

export const SchemaWorkbench = observer(function SchemaWorkbench({
  services,
  editorServices,
  controller,
  view: controlledView,
  defaultView = { type: 'graph-types' },
  onViewChange,
  onSchemaChange,
  sidebar,
}: SchemaWorkbenchProps) {
  const owned = useMemo(() => controller ?? new SchemaController(services), [controller, services]);
  const defaultEditorServices = useMemo(() => ({ execute: services.execute }), [services]);
  const [view, setView] = useState(defaultView);
  useEffect(() => {
    let active = true;
    if (!controller) owned.reset();
    void (async () => {
      if (!owned.currentSchema.path) await owned.refreshCurrentSchema();
      if (!active) return;
      await owned.getSchemas();
      if (!active) return;
      await Promise.all([owned.updateGraphTypesBySchema(), owned.updateGraphsBySchema()]);
    })().catch(() => {});
    return () => {
      active = false;
      if (!controller) owned.destroy();
    };
  }, [owned, controller]);
  return (
    <SchemaWorkspace
      controller={owned}
      editorServices={editorServices ?? defaultEditorServices}
      view={controlledView ?? view}
      sidebar={sidebar}
      onSchemaChange={onSchemaChange}
      navigate={(next) => {
        if (!controlledView) setView(next);
        onViewChange?.(next);
      }}
    />
  );
});
