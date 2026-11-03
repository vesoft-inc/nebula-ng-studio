import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { SchemaTree, CreateGraphDialog, type generateTreeNodeKey } from '@vesoft-inc/studio-ui-internal/schema';
import type { ISchemaTreeRawData } from '@vesoft-inc/studio-ui-internal/schema/types';
import { SchemaItemType } from '@vesoft-inc/studio-ui-internal/utilities';
import { useModal } from '@vesoft-inc/studio-ui-internal/modal';
import type { SchemaTreePanelProps, SchemaTreeSelection } from '../schema';
import { useStudioScope } from '../provider';
import { requireService, useWorkbench } from './hooks';
import { acquireSchema } from './schema';
import { WorkbenchContainer } from './container';

type Catalog = ReturnType<typeof acquireSchema>;
type ReadResult = { code: number; message?: string } | undefined | void;
type Read = () => Promise<ReadResult>;
type Lease = { active: boolean };

function assertSuccess(response: ReadResult) {
  if (response && response.code !== 0) throw new Error(response.message);
}

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && error.name === 'AbortError';
}

const nodeKey: typeof generateTreeNodeKey = (type, names) =>
  JSON.stringify([type, names.graphTypeName, names.entityTypeName, names.propertyName, names.graphName]);

function selectionFor(schemaPath: string, data?: ISchemaTreeRawData): SchemaTreeSelection | undefined {
  switch (data?.type) {
    case SchemaItemType.GraphType:
      return { schemaPath, kind: 'graph-types' };
    case SchemaItemType.Graph:
      return { schemaPath, kind: 'graphs' };
    case SchemaItemType.GraphTypeDescItem:
      if (data.graphType) return { schemaPath, kind: 'graph-type', graphTypeName: data.graphType.graph_type };
      break;
    case SchemaItemType.GraphDescItem:
      if (data.graph) return { schemaPath, kind: 'graph', graphName: data.graph.graph };
      break;
    case SchemaItemType.EntityTypeDescItem:
    case SchemaItemType.PropertyDescItem:
      if (data.graphType && data.entity) {
        const names = { graphTypeName: data.graphType.graph_type, entityTypeName: data.entity.type_name };
        if (data.type === SchemaItemType.EntityTypeDescItem) return { schemaPath, kind: 'entity-type', ...names };
        if (data.property && 'property_name' in data.property && typeof data.property.property_name === 'string')
          return { schemaPath, kind: 'property', ...names, propertyName: data.property.property_name };
      }
  }
  return undefined;
}

function selectionKey(selection: SchemaTreeSelection): string {
  switch (selection.kind) {
    case 'graph-types':
      return nodeKey(SchemaItemType.GraphType, {});
    case 'graphs':
      return nodeKey(SchemaItemType.Graph, {});
    case 'graph-type':
      return nodeKey(SchemaItemType.GraphTypeDescItem, selection);
    case 'graph':
      return nodeKey(SchemaItemType.GraphDescItem, selection);
    case 'entity-type':
      return nodeKey(SchemaItemType.EntityTypeDescItem, selection);
    case 'property':
      return nodeKey(SchemaItemType.PropertyDescItem, selection);
  }
}

interface PanelContentProps {
  catalog: Catalog;
  schemaPath: string;
  isMounted: () => boolean;
  switchSchema: (path: string) => Promise<ReadResult>;
  options: SchemaTreePanelProps;
}

const PanelContent = observer(function PanelContent({
  catalog,
  schemaPath,
  isMounted,
  switchSchema,
  options,
}: PanelContentProps) {
  const { controller, initialize } = catalog.value;
  const { t } = useTranslation('common');
  const { message } = useModal();
  const lease = useRef<Lease | undefined>(undefined);
  const latest = useRef({ options, isMounted });
  latest.current = { options, isMounted };
  const [selected, setSelected] = useState<SchemaTreeSelection | null>(null);
  const [graphDialogOpen, setGraphDialogOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<{ message: string; retry?: Read }>();
  const { showDetail = false, collapsed = false, schemaLabel } = options;

  useLayoutEffect(() => {
    const current = { active: true };
    lease.current = current;
    setPending(0);
    return () => {
      current.active = false;
    };
  }, []);

  const isCurrent = useCallback(
    (current: Lease | undefined) =>
      !!current?.active &&
      catalog.lifetime.active &&
      latest.current.isMounted() &&
      controller.currentSchema.path === schemaPath,
    [catalog, controller, schemaPath]
  );
  const reportError = useCallback(
    (failure: unknown, retry?: Read) => {
      if (isAbortError(failure)) return;
      setError({
        message: failure instanceof Error && failure.message ? failure.message : t('schemaTreeLoadFailed'),
        retry,
      });
    },
    [t]
  );
  const read = useCallback(
    async (load: Read) => {
      const current = lease.current;
      if (!isCurrent(current)) return;
      setPending((count) => count + 1);
      setError(undefined);
      try {
        const response = await load();
        if (isCurrent(current)) assertSuccess(response);
      } catch (failure) {
        if (isCurrent(current)) reportError(failure, load);
      } finally {
        if (isCurrent(current)) setPending((count) => count - 1);
      }
    },
    [isCurrent, reportError]
  );

  useEffect(() => {
    void read(async () => {
      await initialize();
      if (controller.currentSchema.path !== schemaPath) return;
      return controller.getSchemas();
    });
  }, [controller, initialize, read, schemaPath]);

  const activeSelection = options.selected === undefined ? selected : options.selected;
  const selectedKeys = activeSelection?.schemaPath === schemaPath ? [selectionKey(activeSelection)] : [];

  return (
    <>
      <Box aria-busy={pending > 0} sx={{ flexShrink: 0 }}>
        {pending > 0 && <CircularProgress size={16} aria-label={t('schema')} />}
        {error && (
          <Alert
            severity="error"
            action={
              error.retry && (
                <Button disabled={pending > 0} onClick={() => void read(error.retry!)}>
                  {t('retry')}
                </Button>
              )
            }
          >
            {error.message}
          </Alert>
        )}
      </Box>
      <SchemaTree
        schema={controller.currentSchema}
        getNodeKey={nodeKey}
        showDetail={showDetail}
        selectedKeys={selectedKeys}
        onItemSelected={({ rawData }) => {
          const selection = selectionFor(schemaPath, rawData);
          if (selection && isCurrent(lease.current)) {
            if (latest.current.options.selected === undefined) setSelected(selection);
            latest.current.options.onSelect?.(selection);
          }
        }}
        onLoadNode={({ rawData }) =>
          read(async () => {
            switch (rawData?.type) {
              case SchemaItemType.GraphType:
                return controller.updateGraphTypesBySchema();
              case SchemaItemType.Graph:
                return controller.updateGraphsBySchema();
              case SchemaItemType.GraphTypeDescItem:
                if (showDetail && rawData.graphType)
                  return controller.updateGraphTypeDetailBySchema(rawData.graphType.graph_type);
                break;
              case SchemaItemType.EntityTypeDescItem:
                if (showDetail && rawData.entity)
                  return controller.updateEntityTypeDescsBySchema(
                    rawData.entity.graph_type_name,
                    rawData.entity.type_name
                  );
            }
            return undefined;
          })
        }
        onCreateGraphType={options.onCreateGraphType}
        onCreateGraph={() => {
          const current = lease.current;
          void read(async () => {
            assertSuccess(await controller.updateGraphTypesBySchema());
            if (isCurrent(current)) setGraphDialogOpen(true);
          });
        }}
        selector={{
          schemas: controller.schemas,
          schemaLabel: schemaLabel ?? (schemaPath.split('/').pop() || t('schema')),
          collapsed,
          switching: controller.switchingSchema,
          onViewAllSchemas: options.onViewAllSchemas,
          onSwitchSchema: async (schema) => {
            const current = lease.current;
            try {
              const response = await switchSchema(schema.path);
              if (!response) return false;
              assertSuccess(response);
              // A successful switch replaces this subtree; its provider notification is owned above it.
              if (current?.active) message.success(t('switchSchemaSuccess'));
              return true;
            } catch (failure) {
              if (isCurrent(current) && !isAbortError(failure))
                message.error(failure instanceof Error && failure.message ? failure.message : t('error'));
              return false;
            }
          },
          onCreateSchema: async (path) => {
            const current = lease.current;
            try {
              assertSuccess(await controller.createSchema(path));
            } catch (failure) {
              if (isCurrent(current) && !isAbortError(failure))
                message.error(failure instanceof Error && failure.message ? failure.message : t('error'));
              return false;
            }
            if (isCurrent(current)) {
              await read(() => controller.getSchemas());
              if (isCurrent(current)) latest.current.options.onSchemaCreated?.(path);
            }
            return true;
          },
        }}
      />
      {graphDialogOpen && (
        <CreateGraphDialog
          open
          graphTypes={controller.currentSchema.graphTypes}
          onCancel={() => setGraphDialogOpen(false)}
          onCreate={async (values) => {
            const current = lease.current;
            try {
              const response = await controller.createGraph(values.graphName, values.graphType);
              if (!isCurrent(current)) return { code: -1 };
              assertSuccess(response);
              return response;
            } catch (failure) {
              if (isCurrent(current) && !isAbortError(failure))
                message.error(failure instanceof Error && failure.message ? failure.message : t('error'));
              return { code: -1 };
            }
          }}
          onOk={() => {
            setGraphDialogOpen(false);
            void read(() => controller.updateGraphsBySchema());
          }}
        />
      )}
    </>
  );
});

export const SchemaTreePanel = observer(function SchemaTreePanel(props: SchemaTreePanelProps) {
  const { services } = useStudioScope();
  requireService(services, 'schema');
  const binding = useWorkbench('SchemaTreePanel', { schema: services.schema }, (scope) =>
    acquireSchema(scope, services)
  );
  const catalog = binding.resource;
  if (!catalog) return null;
  const controller = catalog.value.controller;
  return (
    <WorkbenchContainer
      className={props.className}
      style={{ display: 'flex', flexDirection: 'column', ...props.style }}
    >
      <PanelContent
        key={controller.currentSchema.path}
        catalog={catalog}
        schemaPath={controller.currentSchema.path}
        isMounted={binding.isMounted}
        options={props}
        switchSchema={catalog.value.switchSchema}
      />
    </WorkbenchContainer>
  );
});
