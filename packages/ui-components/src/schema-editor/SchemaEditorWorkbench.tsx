import { useEffect, useMemo } from 'react';
import SchemaEditorController from './SchemaEditorController';
import { GraphTypeStoreProvider } from './context';
import SchemaEditor, { type SchemaEditorProps } from './Builder';
import type { SchemaEditorServices } from './services';

export interface SchemaEditorWorkbenchProps extends SchemaEditorProps {
  services: SchemaEditorServices;
  controller?: SchemaEditorController;
}

export function SchemaEditorWorkbench({ services, controller, ...props }: SchemaEditorWorkbenchProps) {
  const owned = useMemo(() => controller ?? new SchemaEditorController(services), [controller, services]);
  useEffect(
    () => () => {
      if (!controller) owned.destroy();
    },
    [owned, controller]
  );
  return (
    <GraphTypeStoreProvider value={owned}>
      <SchemaEditor {...props} />
    </GraphTypeStoreProvider>
  );
}
