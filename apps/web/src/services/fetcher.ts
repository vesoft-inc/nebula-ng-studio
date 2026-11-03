import axios, { type AxiosRequestConfig } from 'axios';
import { parseResponseBody, mergeAbortSignals } from '@vesoft-inc/studio-core/request';
import { HttpResCode, HTTP_CANCEL_CODE } from '@vesoft-inc/studio-core/contracts';
export { HTTP_CANCEL_CODE } from '@vesoft-inc/studio-core/contracts';
import { modalStore } from '@vesoft-inc/studio-ui-internal/modal';
import { sessionRequests } from './sessionRequests';

declare module 'axios' {
  interface AxiosRequestConfig {
    errTip?: boolean;
    errMsgInterceptor?: (message?: string) => string | null | undefined | void;
  }
}

export type ConfigType = AxiosRequestConfig;

function createHttpClient(errTip: boolean) {
  const signalDisposers = new WeakMap<object, () => void>();
  const requestSessions = new WeakMap<object, AbortSignal>();

  const baseUrl = '/api-studio';

  const fetcher = axios.create({
    baseURL: baseUrl,
    errTip,
    errMsgInterceptor: (message) => message,
    transformResponse: [(data, headers, status) => parseResponseBody(data, headers.get('content-type'), status)],
  });

  fetcher.interceptors.request.use((config) => {
    config.headers['Content-Type'] = 'application/json';
    const session = sessionRequests.signal;
    const request = mergeAbortSignals(config.signal, session);
    config.signal = request.signal;
    signalDisposers.set(config, request.dispose);
    requestSessions.set(config, session);
    return config;
  });
  fetcher.interceptors.response.use(
    (response) => {
      signalDisposers.get(response.config)?.();
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
      const session = error.config && requestSessions.get(error.config);
      if (session && session !== sessionRequests.signal) {
        return { ...response, data: { code: HTTP_CANCEL_CODE } };
      }
      let errTip = error.response?.config?.errTip;
      if (response.data?.code === HttpResCode.ErrSession || response.data?.code === HttpResCode.ErrNoClient) {
        if (session) sessionRequests.expire(session);
      }
      if (response.data?.code === HttpResCode.ErrSession) {
        errTip = false;
      }
      if (errTip) {
        const message = modalStore.message;
        const respMsg = response.data?.message?.replace(/^\w+::/, '');
        const msgContent = respMsg || error?.message || 'Unknown error';

        if (message) {
          let validMsg = msgContent;
          if (response.config?.errMsgInterceptor) {
            validMsg = response.config.errMsgInterceptor(msgContent);
          }
          if (validMsg) {
            message.error(validMsg);
            console.error(validMsg);
          }
        } else {
          console.error(msgContent);
        }
      }
      return response;
    }
  );

  return fetcher;
}

export const fetcher = createHttpClient(true);
export const backgroundFetcher = createHttpClient(false);
