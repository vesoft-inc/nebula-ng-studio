import { createContext, useContext } from 'react';
import type SchemaController from './SchemaController';

const SchemaContext = createContext<SchemaController | null>(null);
export const SchemaProvider = SchemaContext.Provider;
export function useSchema() {
  const controller = useContext(SchemaContext);
  if (!controller) throw new Error('SchemaProvider is required');
  return controller;
}
