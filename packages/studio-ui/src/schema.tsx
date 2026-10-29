import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { ISchemaItem, NebulaSchema } from '@vesoft-inc/studio-core/contracts';
import { SchemaWorkbench as InternalSchema, SchemaTree as InternalTree } from '@vesoft-inc/studio-ui-internal/schema';
import type { ISchemaTreeRawData } from '@vesoft-inc/studio-ui-internal/schema/types';
import { useStudioScope } from './provider';
import { requireService, useWorkbench } from './internal/hooks';
import { acquireSchema, acquireEditor } from './internal/schema';
import { WorkbenchContainer } from './internal/container';
import type { SchemaEditorMode } from './schema-editor';

export type { SchemaServices, QueryExecutor, QueryOptions } from './services';
export type { ISchemaTreeRawData as SchemaTreeItem } from '@vesoft-inc/studio-ui-internal/schema/types';
export { SchemaItemType } from '@vesoft-inc/studio-ui-internal/utilities';
export type SchemaView =
  | { type: 'schemas' | 'graph-types' | 'graphs' | 'sketches' }
  | { type: 'graph'; name: string }
  | { type: 'editor'; mode: SchemaEditorMode; graphTypeName?: string; sketchId?: number };
export interface SchemaWorkbenchProps {
  view?: SchemaView;
  defaultView?: SchemaView;
  onViewChange?: (view: SchemaView) => void;
  sidebar?: ReactNode;
  className?: string;
  style?: CSSProperties;
}
export function SchemaWorkbench({ className, style, ...props }: SchemaWorkbenchProps): ReactElement | null {
  const { services } = useStudioScope();
  requireService(services, 'schema');
  const binding = useWorkbench(
    'SchemaWorkbench',
    { schema: services.schema, schemaEditor: services.schemaEditor },
    (scope) => {
      const catalog = acquireSchema(scope, services);
      const editor = acquireEditor(scope, services, true);
      return {
        ...catalog,
        isCurrent: () => editor.lifetime.active,
        value: { ...catalog.value, editorServices: editor.value },
      };
    }
  );
  if (!binding.resource) return null;
  return (
    <WorkbenchContainer className={className} style={style}>
      <InternalSchema
        {...props}
        {...binding.resource.value}
        onViewChange={binding.guard(props.onViewChange)}
        onSchemaChange={binding.guard((path) => binding.scope.setSchema(path))}
      />
    </WorkbenchContainer>
  );
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
