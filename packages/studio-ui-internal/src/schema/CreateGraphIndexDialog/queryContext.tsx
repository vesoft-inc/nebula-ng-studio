import { createContext, useContext } from 'react';
import type { QueryExecutor } from '../../shared/query';

export type RunGql = QueryExecutor;

const IndexQueryContext = createContext<RunGql | null>(null);

export const IndexQueryProvider = IndexQueryContext.Provider;

export function useIndexQuery() {
  const runGql = useContext(IndexQueryContext);
  if (!runGql) {
    throw new Error('IndexQueryProvider is required');
  }
  return runGql;
}
