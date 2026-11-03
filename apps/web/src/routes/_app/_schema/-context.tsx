import { createContext, useContext } from 'react';
import type { SchemaEditorServices } from '@vesoft-inc/studio-ui-internal/schema-editor/model';

export const SchemaEditorServicesContext = createContext<SchemaEditorServices | null>(null);
export function useSchemaEditorServices() {
  const services = useContext(SchemaEditorServicesContext);
  if (!services) throw new Error('Schema route services are required');
  return services;
}
