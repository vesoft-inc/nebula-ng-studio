import type { AxiosInstance } from 'axios';
import type { ConsoleServices } from '../../services';
import { createQuery } from './request';

export interface StudioServerConsoleOptions {
  http: AxiosInstance;
}

export function createStudioServerConsoleServices({ http }: StudioServerConsoleOptions): ConsoleServices {
  return { execute: createQuery(http, '/nebula/console/execGql'), query: createQuery(http) };
}
