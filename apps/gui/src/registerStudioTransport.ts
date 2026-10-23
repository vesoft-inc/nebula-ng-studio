import type { ServerResponse } from '@vesoft-inc/utils';
import { execGql, fetchUserInfo, killQueriesBySessionId } from '@gui/services';
import { getToken } from '@gui/utils/auth';
import { registerGuiTransport, type GuiGqlConfig } from '@studio/services/guiTransport';

registerGuiTransport({
  execGql: async <T extends object>(gql: string, config?: GuiGqlConfig) => {
    const res = await execGql(gql, config);
    return res as unknown as ServerResponse<T>;
  },
  fetchUserInfo,
  killQueriesBySessionId: async (sessionId) => {
    await killQueriesBySessionId(sessionId);
  },
  getToken,
});
