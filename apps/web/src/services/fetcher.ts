import { FetchService, HttpResCode, mergeAbortSignals, type ServiceProps } from '@vesoft-inc/utils';
import { modalStore } from '@vesoft-inc/ui-components/modal';
import { JSONBig } from '@vesoft-inc/ui-components/utilities';
import { sessionRequests } from './sessionRequests';

export type ConfigType = ServiceProps['config'];

const signalDisposers = new WeakMap<object, () => void>();
const requestSessions = new WeakMap<object, AbortSignal>();

export const HTTP_CANCEL_CODE = 499;

const baseUrl = '/api-studio';

export const fetcher = new FetchService({
  config: {
    errTip: true,
    errMsgInterceptor: (errMsg?: string) => errMsg,
    baseURL: baseUrl,
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
  },
  interceptorsEjectors(ins) {
    ins.interceptors.request.use((config) => {
      config.headers['Content-Type'] = 'application/json';
      const session = sessionRequests.signal;
      const request = mergeAbortSignals(config.signal, session);
      config.signal = request.signal;
      signalDisposers.set(config, request.dispose);
      requestSessions.set(config, session);
      return config;
    });
    ins.interceptors.response.use(
      (response) => {
        signalDisposers.get(response.config)?.();
        return response;
      },
      (error) => {
        if (error.config) signalDisposers.get(error.config)?.();
        const isCancelError = error?.code === 'ERR_CANCELED';
        const response = error?.response || {
          data: {
            code: isCancelError ? HTTP_CANCEL_CODE : HttpResCode.ErrUnknown,
            message: error?.message || 'Unknown error',
          },
        };
        const session = error.config && requestSessions.get(error.config);
        if (session && session !== sessionRequests.signal) {
          return { ...response, data: { code: HTTP_CANCEL_CODE } };
        }
        let errTip = response.config?.errTip;
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
  },
});
