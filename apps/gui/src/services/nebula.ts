import { IUserInfo } from '@studio/interfaces';
import { ConfigType, fetcher } from './fetcher';
import { parseGqlResult, RestGqlResultParams } from '../utils/gql';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResponseData {
  token?: string;
}
export const EXECUTION_SUCCESS_CODE = '00000';

export const connect = async (payload: { username: string; password: string }) => {
  const res = await fetcher.post('/auth', payload);
  return res;
};

export const disconnect = async () => {
  const res = await fetcher.post('/signout');
  return res;
};

export const execGql = async (gql: string, config?: ConfigType) => {
  const startTime = Date.now();
  const res = await fetcher.post<RestGqlResultParams>('/gql', { gql, timeout: config?.timeout }, config);
  const data = res as unknown as RestGqlResultParams;
  const duration = Date.now() - startTime;
  const parsedData = parseGqlResult(data, duration);
  if (data.code === EXECUTION_SUCCESS_CODE) {
    return {
      code: 0,
      data: parsedData,
      message: 'Success',
    };
  } else {
    return {
      code: data.code,
      data: null,
      message: data.message,
    };
  }
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
  const res = await fetcher.delete(`/sessions/${sessionId}/query`);
  return res;
};

export const fetchCoreInfo = () => {
  return fetcher.get('/info', undefined, { errTip: false, timeout: 2000 }).then((res) => {
    return res as unknown as {
      version: string;
      buildTime: string;
      vendor: string;
      gitSHA: string;
      protocolVersion: string;
      supportedProtocolVersions: string[];
    };
  });
};
