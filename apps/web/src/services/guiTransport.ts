import type { IUserInfo } from '@studio/interfaces';
import type { ServerResponse } from '@vesoft-inc/utils';
import type { ConfigType } from './fetcher';

export type GuiGqlConfig = ConfigType & { queryTimeout?: number };

export type GuiTransport = {
  execGql: <T extends object>(gql: string, config?: GuiGqlConfig) => Promise<ServerResponse<T>>;
  fetchUserInfo: () => Promise<IUserInfo>;
  killQueriesBySessionId: (sessionId: string) => Promise<void>;
  getToken: () => string;
};

let transport: GuiTransport | undefined;

export function registerGuiTransport(next: GuiTransport) {
  transport = next;
}

export function getGuiTransport() {
  return transport;
}

export function readGuiToken() {
  return transport?.getToken() ?? '';
}
