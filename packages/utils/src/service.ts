/* eslint @typescript-eslint/no-explicit-any: "off" */
import axios, { type AxiosRequestConfig, type AxiosInstance } from 'axios';
import { HttpResCode, JSONBig } from './constant';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * @description Whether to display the error message
     * ```ts
     * const withErrTip = errTip ?? true
     * withErrTip && MessageBox.error(message)
     * ```
     */
    errTip?: boolean;

    /**
     * Customize err msg output
     */
    errMsgInterceptor?: (errMsg?: string) => string | null | undefined | void;
  }
}

export interface ServerResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  msg?: string;
  model?: T;
  ip?: string;
  details?: string;
}

export interface ServiceProps {
  config?: AxiosRequestConfig;
  interceptorsEjectors?: (instance: AxiosInstance) => void;
}

export const BaseFetcherConfig: AxiosRequestConfig = {
  errTip: true,
  // timeout: 600000,
  transformResponse: [
    (data, header, code) => {
      if (header.get('content-type') !== 'application/json') {
        if (code! >= 200 && code! < 300) {
          return { code: 0, data };
        }

        // other http error status
        // code === 503 && data === 'Request Timeout'
        // return { code: 503, message: 'Request Timeout' }
        return { code, message: data };
      }
      try {
        return JSONBig.parse(data);
      } catch (e) {
        return { code: HttpResCode.ErrUnknown, message: `${e}`, data };
      }
    },
  ],
};

export class FetchService {
  instance: AxiosInstance;

  constructor({ config = {}, interceptorsEjectors }: ServiceProps = {}) {
    this.instance = axios.create(config);
    interceptorsEjectors?.(this.instance);
  }

  get<R = any>(url: string, params?: unknown, config?: AxiosRequestConfig) {
    return this.instance.get<ServerResponse<R>>(url, { params, ...config });
  }

  post<R = any>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.post<ServerResponse<R>>(url, data, config);
  }

  put<R = any>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.put<ServerResponse<R>>(url, data, config);
  }

  delete<R = any>(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete<ServerResponse<R>>(url, config);
  }
}
