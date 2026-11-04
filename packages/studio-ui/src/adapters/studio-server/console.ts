import type { AxiosInstance } from 'axios';
import type { ConsoleServices } from '../../services';
import { createQuery } from './request';

/**
 * Host HTTP configuration for the Console service adapter.
 * @public
 */
export interface StudioServerConsoleOptions {
  /** Host Axios client with the Studio Server API prefix, authentication and response/error policy configured. */
  http: AxiosInstance;
}

/**
 * Creates Console query services without making initialization requests.
 *
 * @remarks
 * Execution uses `/nebula/console/execGql`; metadata queries use `/gql/exec`.
 * Query timeouts are sent to the server in milliseconds, independently of Axios network timeouts.
 * Server-side cancellation and query session IDs are not supplied by this adapter.
 * @public
 */
export function createStudioServerConsoleServices({ http }: StudioServerConsoleOptions): ConsoleServices {
  return { execute: createQuery(http, '/nebula/console/execGql'), query: createQuery(http) };
}
