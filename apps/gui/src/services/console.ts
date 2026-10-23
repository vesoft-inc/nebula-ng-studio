import type { GQLResult, ServerResponse } from '@vesoft-inc/utils';
import type { ConsoleServices, QueryExecutor } from '@vesoft-inc/ui-components/console/model';
import { execGql, killQueriesBySessionId } from './nebula';

const query: QueryExecutor = async <T extends object>(gql: string, options?: Parameters<QueryExecutor>[1]) => {
  const { queryTimeout, ...config } = options ?? {};
  const result = await execGql(gql, {
    ...config,
    timeout: queryTimeout,
    ...(queryTimeout && queryTimeout > 0 ? { headers: { 'X-Request-Timeout': queryTimeout } } : {}),
  });
  return result as unknown as ServerResponse<T>;
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
