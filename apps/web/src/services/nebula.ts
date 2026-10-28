import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { IUserInfo } from '@vesoft-inc/ui-components/schema/types';
import { ConfigType, fetcher } from './fetcher';
export const connect = async (payload: { address: string }, config: { headers: { Authorization: string } }) => {
  const res = await fetcher.post<ServerResponse>('/db/connect', payload, config);
  return res.data;
};

export const oauth2Connect = async (payload: { address: string }) => {
  const res = await fetcher.post<ServerResponse<{ redirect: string; clientID: string }>>('/db/oauth2-connect', payload);
  return res.data;
};

export const fetchOauth2Config = async () => {
  const res = await fetcher.get<ServerResponse<{ enabled: boolean }>>('/db/oauth2-config', { errTip: false });
  return res.data;
};

export const disconnect = async () => {
  const res = await fetcher.post<
    ServerResponse<{
      data: {
        redirectUrl: string;
      };
    }>
  >('/db/disconnect');
  return res.data;
};

export const execGql = async <T extends object>(gql: string, config?: ConfigType & { queryTimeout?: number }) => {
  const res = await fetcher.post<ServerResponse<T>>('/gql/exec', { gql, timeout: config?.queryTimeout }, config);
  return res.data;
};

export const execConsoleGql = async <T extends object>(
  gql: string,
  config?: ConfigType & { queryTimeout?: number }
) => {
  const res = await fetcher.post<ServerResponse<T>>(
    '/nebula/console/execGql',
    { gql, timeout: config?.queryTimeout },
    config
  );
  return res.data;
};

export const importDataParams = async <T>(dataSet: string) => {
  const res = await fetcher.post<ServerResponse<T>>('/nebula/import-data', { dataSet });
  return res.data;
};

export const fetchUserInfo = async () => {
  const res = await fetcher.get<ServerResponse<IUserInfo>>('/nebula/userInfo');
  return res.data;
};

export const changeSchema = async (schemaPath: string) => {
  const res = await fetcher.post<ServerResponse>('/nebula/changeSchema', { schemaPath });
  return res.data;
};
