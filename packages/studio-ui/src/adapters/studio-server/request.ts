import type { AxiosInstance } from 'axios';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { QueryExecutor, QueryOptions } from '../../services';

export function checkAbort(options?: QueryOptions): void {
  if (options?.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
}

export function requestConfig(options?: QueryOptions) {
  checkAbort(options);
  return { signal: options?.signal };
}

export async function response<T>(request: Promise<{ data: T }>, options?: QueryOptions): Promise<T> {
  const result = await request;
  checkAbort(options);
  return result.data;
}

export function createQuery(http: AxiosInstance, path = '/gql/exec'): QueryExecutor {
  return async <T extends object>(gql: string, options?: QueryOptions) =>
    response(
      http.post<ServerResponse<T>>(path, { gql, timeout: options?.queryTimeout }, requestConfig(options)),
      options
    );
}
