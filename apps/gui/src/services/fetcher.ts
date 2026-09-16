import { FetchService, HttpResCode, type ServiceProps } from '@vesoft-inc/utils';
import { JSONBig } from '@studio/utils';
import { getRootStore } from '@gui/stores';
import { getToken } from '../utils/auth';

export type ConfigType = ServiceProps['config'];

let controller = new AbortController();

export const HTTP_CANCEL_CODE = 499;

const baseUrl = process.env.NODE_ENV === 'development' ? '/api-gui' : '/';

export const fetcher = new FetchService({
  config: {
    errTip: true,
    baseURL: baseUrl,
    transformResponse: [
      (data, header, code) => {
        if (header.get('content-type') !== 'application/json') {
          if (code! >= 200 && code! < 300) {
            return { code: 0, data };
          }

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
      config.signal = controller.signal;

      const token = getToken();

      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      return config;
    });
    ins.interceptors.response.use(
      (response) => {
        if (response.data.code !== undefined && typeof response.data.data === 'string') {
          return JSON.parse(response.data.data);
        }
        return response.data;
      },
      (error) => {
        const isCancelError = error?.code === 'ERR_CANCELED';
        const response = error?.response || {
          data: { code: isCancelError ? HTTP_CANCEL_CODE : HttpResCode.ErrUnknown },
        };
        const errTip = response.config?.errTip;

        const isAuthError = response.status === 401;

        if (isAuthError) {
          const rootStore = getRootStore();
          rootStore?.commonStore.clearUserInfo();

          controller.abort();
          controller = new AbortController();
        }
        if (errTip) {
          if (response.status === 500) {
            const message = getRootStore()?.modalStore?.message;
            const msgContent = response.data?.message || error?.message || 'internal server error';
            message ? message.error(msgContent) : console.error(msgContent);
          }
        }
        return response.data;
      }
    );
  },
});
