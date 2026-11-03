import { useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { CreateGraphDialog, SchemaProvider } from '@vesoft-inc/studio-ui-internal/schema';
import { SchemaEditorProvider } from '@vesoft-inc/studio-ui-internal/schema-editor';
import { SchemaEditorController } from '@vesoft-inc/studio-ui-internal/schema-editor/model';
import { commonStore, schemaStore } from '@studio/app/session';
import { routePaths } from '@studio/app/paths';
import { createSchemaEditorServices } from '@studio/services/schemaEditor';
import { resolveSchemaPath } from '@studio/services/schemaLayout';
import { SchemaEditorServicesContext } from './-context';

export const SchemaSession = observer(function SchemaSession() {
  const navigate = useNavigate();
  const { address, username, curSchemaPath } = commonStore.userInfo ?? {};
  const schemaPath = resolveSchemaPath(curSchemaPath, schemaStore.currentSchema.path);
  const services = useMemo(
    () => createSchemaEditorServices({ address, username, schemaPath }),
    [address, username, schemaPath]
  );
  const editor = useMemo(() => new SchemaEditorController(services), [services, schemaStore.currentSchema.path]);
  const session = useMemo(() => ({ active: false }), [editor]);
  useEffect(() => {
    session.active = true;
    return () => {
      session.active = false;
      editor.destroy();
    };
  }, [editor, session]);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!schemaStore.currentSchema.path) await schemaStore.refreshCurrentSchema();
      if (!active) return;
      await schemaStore.getSchemas();
      if (active) await Promise.all([schemaStore.updateGraphTypesBySchema(), schemaStore.updateGraphsBySchema()]);
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <SchemaProvider value={schemaStore}>
      <SchemaEditorServicesContext.Provider value={services}>
        <SchemaEditorProvider value={editor}>
          <Box height="100%" key={schemaStore.currentSchema.path}>
            <Outlet />
          </Box>
          <CreateGraphDialog
            open={schemaStore.createGraphModalInfo.visible}
            graphTypes={schemaStore.currentSchema.graphTypes}
            onCancel={() => schemaStore.updateCreateGraphModalInfo({ visible: false })}
            onCreate={(values) => schemaStore.createGraph(values.graphName, values.graphType)}
            onOk={() => {
              if (!session.active) return;
              schemaStore.updateCreateGraphModalInfo({ visible: false });
              void schemaStore.updateGraphsBySchema().catch(() => {});
              navigate({ to: routePaths.schema.graphs });
            }}
          />
        </SchemaEditorProvider>
      </SchemaEditorServicesContext.Provider>
    </SchemaProvider>
  );
});
