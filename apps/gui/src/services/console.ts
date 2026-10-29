import type { GQLResult } from '@vesoft-inc/studio-core/contracts';
import type { ConsoleServices, QueryExecutor } from '@vesoft-inc/studio-ui-internal/console/model';
import { execGql, killQueriesBySessionId } from './nebula';

const query: QueryExecutor = async <T extends object>(gql: string, options?: Parameters<QueryExecutor>[1]) => {
  const { queryTimeout, ...config } = options ?? {};
  const result = await execGql(gql, {
    ...config,
    timeout: queryTimeout,
    ...(queryTimeout && queryTimeout > 0 ? { headers: { 'X-Request-Timeout': queryTimeout } } : {}),
  });
  // The query caller supplies its expected result shape at this protocol boundary.
  const data: unknown = result.data;
  return { code: result.code, message: result.message, data: data as T | undefined };
};
export const guiConsoleServices: ConsoleServices = {
  execute: query,
  query,
  getSessionId: async (options) => {
    const result = await query<GQLResult<{ id: string }>>('SHOW CURRENT_SESSION', options);
    return result.data?.tables?.[0]?.id?.toString();
  },
  cancelQuery: async (sessionId) => {
    await killQueriesBySessionId(sessionId);
  },
};
