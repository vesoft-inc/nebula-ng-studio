import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';

/** Query timeout is expressed in milliseconds. Transport headers belong to the host adapter. */
export interface QueryOptions {
  signal?: AbortSignal;
  queryTimeout?: number;
  errTip?: boolean;
  /** Optional host error presentation policy; returning null suppresses the message. */
  errMsgInterceptor?: (message?: string) => string | null | void;
}

export type QueryExecutor = <T extends object>(gql: string, options?: QueryOptions) => Promise<ServerResponse<T>>;

export interface ConsoleServices {
  execute: QueryExecutor;
  query: QueryExecutor;
  /** Omit when the host cannot cancel server-side queries. */
  cancelQuery?: (sessionId: string) => Promise<void>;
  getSessionId?: (options?: QueryOptions) => Promise<string | undefined>;
}
