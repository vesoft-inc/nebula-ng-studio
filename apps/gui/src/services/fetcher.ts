import axios, { type AxiosRequestConfig } from 'axios';
import { parseResponseBody, mergeAbortSignals } from '@vesoft-inc/studio-core/request';
import { HttpResCode, HTTP_CANCEL_CODE } from '@vesoft-inc/studio-core/contracts';
export { HTTP_CANCEL_CODE } from '@vesoft-inc/studio-core/contracts';
import { modalStore } from '@vesoft-inc/ui-components/modal';
import { clearSessionUser } from '../stores/authBridge';
import { getToken } from '../utils/auth';

declare module 'axios' {
  interface AxiosRequestConfig {
    errTip?: boolean;
    errMsgInterceptor?: (message?: string) => string | null | undefined | void;
  }
}

export type ConfigType = AxiosRequestConfig;

let controller = new AbortController();
const signalDisposers = new WeakMap<object, () => void>();

const baseUrl = process.env.NODE_ENV === 'development' ? '/api-gui' : '/';

export const fetcher = axios.create({
  baseURL: baseUrl,
  errTip: true,
  transformResponse: [(data, headers, status) => parseResponseBody(data, headers.get('content-type'), status)],
});

fetcher.interceptors.request.use((config) => {
  config.headers['Content-Type'] = 'application/json';
  const request = mergeAbortSignals(config.signal, controller.signal);
  config.signal = request.signal;
  signalDisposers.set(config, request.dispose);

  const token = getToken();

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  return config;
});
fetcher.interceptors.response.use(
  (response) => {
    signalDisposers.get(response.config)?.();
    if (response.data.code !== undefined && typeof response.data.data === 'string') {
      response.data = JSON.parse(response.data.data);
    }
    return response;
  },
  (error) => {
    if (error.config) signalDisposers.get(error.config)?.();
    const isCancelError = error?.code === 'ERR_CANCELED';
    const response = error?.response || {
      config: error.config,
      status: 0,
      statusText: '',
      headers: {},
      data: {
        code: isCancelError ? HTTP_CANCEL_CODE : HttpResCode.ErrUnknown,
        message: error?.message || 'Unknown error',
      },
    };
    const errTip = response.config?.errTip;

    const isAuthError = response.status === 401;

    if (isAuthError) {
      clearSessionUser();

      controller.abort();
      controller = new AbortController();
    }
    if (errTip) {
      if (response.status === 500) {
        const message = modalStore.message;
        const msgContent = response.data?.message || error?.message || 'internal server error';
        message ? message.error(msgContent) : console.error(msgContent);
      }
    }
    return response;
  }
);
