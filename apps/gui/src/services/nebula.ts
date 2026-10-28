import type { GQLResult, ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { HttpResCode } from '@vesoft-inc/studio-core/contracts';
import { IUserInfo } from '@vesoft-inc/ui-components/schema/types';
import { ConfigType, fetcher } from './fetcher';
import { parseGqlResult, RestGqlResultParams } from '../utils/gql';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResponseData {
  token: string;
}
export const EXECUTION_SUCCESS_CODE = '00000';

export const connect = async (payload: { username: string; password: string }) => {
  const res = await fetcher.post<ServerResponse<LoginResponseData>>('/auth', payload);
  return res.data;
};

export const disconnect = async () => {
  const res = await fetcher.post<ServerResponse>('/signout');
  return res.data;
};

export const execGql = async (gql: string, config?: ConfigType): Promise<ServerResponse<GQLResult>> => {
  const startTime = Date.now();
  const { data } = await fetcher.post<RestGqlResultParams>('/gql', { gql, timeout: config?.timeout }, config);
  const duration = Date.now() - startTime;
  if (data.code === EXECUTION_SUCCESS_CODE) {
    return { code: 0, data: parseGqlResult(data, duration), message: 'Success' };
  }
  const code = Number(data.code);
  return { code: Number.isFinite(code) && code !== 0 ? code : HttpResCode.ErrUnknown, message: data.message };
};

export const fetchUserInfo = async (): Promise<IUserInfo> => {
  const gql = 'SHOW CURRENT_USER';
  const res = await execGql(gql);
  const userMetaData = res?.data?.tables?.[0];

  const coreInfo = await fetchCoreInfo().catch(() => null);
  const coreVersion = coreInfo?.version || '';

  return {
    address: location.hostname,
    username: `${userMetaData?.name || ''}`,
    coreVersion,
    // useless fields for GUI, but need to keep the same structure for Studio
    version: '',
    curSchemaPath: '',
    roles: [''],
    createdTime: '',
  } as IUserInfo;
};

export const killQueriesBySessionId = async (sessionId: string) => {
  const res = await fetcher.delete<ServerResponse>(`/sessions/${sessionId}/query`);
  return res.data;
};

export interface CoreInfo {
  version: string;
  buildTime: string;
  vendor: string;
  gitSHA: string;
  protocolVersion: string;
  supportedProtocolVersions: string[];
}

export const fetchCoreInfo = async (): Promise<CoreInfo> => {
  const response = await fetcher.get<CoreInfo>('/info', { errTip: false, timeout: 2000 });
  return response.data;
};
