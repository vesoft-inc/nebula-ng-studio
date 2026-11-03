import { useEffect, type CSSProperties, type ReactElement } from 'react';
import { observer } from 'mobx-react-lite';
import type { ISchemaItem, NebulaSchema } from '@vesoft-inc/studio-core/contracts';
import {
  SchemaProvider,
  SchemaTree as InternalTree,
  SchemaList as InternalSchemaList,
  GraphTypeList as InternalGraphTypeList,
  GraphList as InternalGraphList,
  GraphInfo as InternalGraphInfo,
  CreateGraphDialog as InternalCreateGraphDialog,
} from '@vesoft-inc/studio-ui-internal/schema';
import type { ISchemaTreeRawData } from '@vesoft-inc/studio-ui-internal/schema/types';
import { useSchemaComponent } from './internal/schema';
import { WorkbenchContainer } from './internal/container';

export type { SchemaServices, QueryExecutor, QueryOptions } from './services';
export type { ISchemaTreeRawData as SchemaTreeItem } from '@vesoft-inc/studio-ui-internal/schema/types';
export { SchemaItemType } from '@vesoft-inc/studio-ui-internal/utilities';

export interface SchemaListProps {
  onOpen?: (schema: ISchemaItem) => void;
  className?: string;
  style?: CSSProperties;
}
export function SchemaList({ className, style, onOpen }: SchemaListProps): ReactElement | null {
  const binding = useSchemaComponent('SchemaList');
  if (!binding.resource || !binding.ready) return null;
  return (
    <WorkbenchContainer className={className} style={style}>
      <SchemaProvider value={binding.resource.value.controller}>
        <InternalSchemaList
          key={binding.scope.schemaPath}
          onSchemaChange={binding.guard((path) => binding.scope.setSchema(path))}
          onOpen={binding.guard((schema) => {
            const opened = { name: schema.name, path: schema.path, owner: schema.owner };
            binding.scope.setSchema(schema.path);
            onOpen?.(opened);
          })}
        />
      </SchemaProvider>
    </WorkbenchContainer>
  );
}

export interface GraphTypeListProps {
  onCreate?: () => void;
  onView?: (name: string) => void;
  onEdit?: (name: string) => void;
  onSketches?: () => void;
  className?: string;
  style?: CSSProperties;
}
export function GraphTypeList({ className, style, ...props }: GraphTypeListProps): ReactElement | null {
  const binding = useSchemaComponent('GraphTypeList', true);
  if (!binding.resource || !binding.ready) return null;
  return (
    <WorkbenchContainer className={className} style={style}>
      <SchemaProvider value={binding.resource.value.controller}>
        <InternalGraphTypeList
          key={binding.scope.schemaPath}
          sketches={binding.resource.value.sketches}
          onCreate={props.onCreate ? binding.guard(props.onCreate) : undefined}
          onView={binding.guard(props.onView)}
          onEdit={binding.guard(props.onEdit)}
          onSketches={props.onSketches ? binding.guard(props.onSketches) : undefined}
        />
      </SchemaProvider>
    </WorkbenchContainer>
  );
}

export interface GraphListProps {
  onView?: (name: string) => void;
  onCreate?: () => void;
  className?: string;
  style?: CSSProperties;
}
export function GraphList({ className, style, ...props }: GraphListProps): ReactElement | null {
  const binding = useSchemaComponent('GraphList');
  if (!binding.resource || !binding.ready) return null;
  return (
    <WorkbenchContainer className={className} style={style}>
      <SchemaProvider value={binding.resource.value.controller}>
        <InternalGraphList
          key={binding.scope.schemaPath}
          onView={binding.guard(props.onView)}
          onCreate={props.onCreate ? binding.guard(props.onCreate) : undefined}
        />
      </SchemaProvider>
    </WorkbenchContainer>
  );
}

export interface GraphInfoProps {
  graphName: string;
  onBack?: () => void;
  className?: string;
  style?: CSSProperties;
}
export function GraphInfo({ className, style, ...props }: GraphInfoProps): ReactElement | null {
  const binding = useSchemaComponent('GraphInfo');
  if (!binding.resource || !binding.ready) return null;
  return (
    <WorkbenchContainer className={className} style={style}>
      <SchemaProvider value={binding.resource.value.controller}>
        <InternalGraphInfo
          key={`${binding.scope.schemaPath}:${props.graphName}`}
          graphName={props.graphName}
          onBack={binding.guard(props.onBack)}
        />
      </SchemaProvider>
    </WorkbenchContainer>
  );
}

export interface CreateGraphDialogProps {
  open: boolean;
  onCancel?: () => void;
  onCreated?: () => void;
}
const ScopedCreateGraphDialog = observer(function ScopedCreateGraphDialog(props: CreateGraphDialogProps) {
  const binding = useSchemaComponent('CreateGraphDialog');
  const controller = binding.resource?.value.controller;
  useEffect(() => {
    if (binding.ready && controller) void controller.updateGraphTypesBySchema().catch(() => {});
  }, [controller, binding.ready, binding.scope.schemaPath]);
  if (!controller || !binding.ready) return null;
  return (
    <InternalCreateGraphDialog
      open
      graphTypes={controller.currentSchema.graphTypes}
      onCancel={binding.guard(props.onCancel)}
      onCreate={(values) => controller.createGraph(values.graphName, values.graphType)}
      onOk={binding.guard(() => {
        void controller.updateGraphsBySchema().catch(() => {});
        props.onCreated?.();
      })}
    />
  );
});
export function CreateGraphDialog(props: CreateGraphDialogProps): ReactElement | null {
  return props.open ? <ScopedCreateGraphDialog {...props} /> : null;
}

export interface SchemaTreeNode {
  key: string;
  rawData?: ISchemaTreeRawData;
}
export interface SchemaSelectorOptions {
  schemaLabel?: string;
  schemas: ISchemaItem[];
  collapsed: boolean;
  switching?: boolean;
  onSwitchSchema: (schema: ISchemaItem) => Promise<boolean>;
  onCreateSchema: (path: string) => Promise<boolean>;
  onViewAllSchemas: () => void;
}
export interface SchemaTreeProps {
  schema: NebulaSchema;
  onItemSelected?: (node: SchemaTreeNode) => void;
  selectedKeys?: string[];
  showDetail?: boolean;
  onReady?: () => void;
  onLoadNode: (node: SchemaTreeNode) => Promise<void>;
  onCreateGraphType?: () => void;
  onCreateGraph?: () => void;
  selector: SchemaSelectorOptions;
}
export function SchemaTree({ onItemSelected, onLoadNode, ...props }: SchemaTreeProps): ReactElement {
  return (
    <InternalTree
      {...props}
      onItemSelected={(node) => onItemSelected?.({ key: node.key, rawData: node.rawData })}
      onLoadNode={(node) => onLoadNode({ key: node.key, rawData: node.rawData })}
    />
  );
}
