import { useEffect, useMemo, type CSSProperties, type ReactElement } from 'react';
import {
  SchemaEditorWorkbench as InternalEditor,
  SchemaEditorProvider,
  SketchList as InternalSketchList,
} from '@vesoft-inc/studio-ui-internal/schema-editor';
import { SchemaEditorController } from '@vesoft-inc/studio-ui-internal/schema-editor/model';
import { GraphTypeBuildMode } from '@vesoft-inc/studio-ui-internal/schema/types';
import { useStudioScope } from './provider';
import { requireService, useWorkbench } from './internal/hooks';
import { acquireEditor } from './internal/schema';
import { WorkbenchContainer } from './internal/container';

export type {
  SchemaEditorServices,
  SchemaLayoutServices,
  SketchServices,
  NodePosition,
  NodeLayoutMap,
  SketchRecord,
  SketchPage,
} from './services';
export type SchemaEditorMode = 'edit' | 'create' | 'readonly' | 'sketch';
export interface SchemaEditorWorkbenchProps {
  mode: SchemaEditorMode;
  graphTypeName?: string;
  sketchId?: number;
  onSaved?: (graphTypeName: string) => void;
  onBack?: () => void;
  onEdit?: (graphTypeName: string) => void;
  onView?: (graphTypeName: string) => void;
  className?: string;
  style?: CSSProperties;
}
export function SchemaEditorWorkbench({ className, style, ...props }: SchemaEditorWorkbenchProps): ReactElement | null {
  const { services } = useStudioScope();
  requireService(services, 'schemaEditor');
  const binding = useWorkbench('SchemaEditorWorkbench', { schemaEditor: services.schemaEditor }, (scope) =>
    acquireEditor(scope, services)
  );
  if (!binding.resource) return null;
  return (
    <WorkbenchContainer className={className} style={style}>
      <InternalEditor
        {...props}
        mode={props.mode as GraphTypeBuildMode}
        services={binding.resource.value}
        onSaved={binding.guard(props.onSaved)}
        onBack={binding.guard(props.onBack)}
        onEdit={binding.guard(props.onEdit)}
        onView={binding.guard(props.onView)}
      />
    </WorkbenchContainer>
  );
}

export interface SketchListProps {
  onOpen?: (id: number) => void;
  className?: string;
  style?: CSSProperties;
}
export function SketchList({ className, style, onOpen }: SketchListProps): ReactElement | null {
  const { services } = useStudioScope();
  requireService(services, 'schemaEditor');
  const binding = useWorkbench('SketchList', { schemaEditor: services.schemaEditor }, (scope) =>
    acquireEditor(scope, services)
  );
  const adapted = binding.resource?.value;
  const controller = useMemo(() => (adapted ? new SchemaEditorController(adapted) : undefined), [adapted]);
  useEffect(() => () => controller?.destroy(), [controller]);
  if (!controller || !binding.resource) return null;
  return (
    <WorkbenchContainer className={className} style={style}>
      <SchemaEditorProvider value={controller}>
        <InternalSketchList onOpen={binding.guard(onOpen)} />
      </SchemaEditorProvider>
    </WorkbenchContainer>
  );
}
