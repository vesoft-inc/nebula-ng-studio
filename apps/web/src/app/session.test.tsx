// @vitest-environment jsdom
import '@studio/test-support/routerEnvironment';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { HttpResCode } from '@vesoft-inc/utils';
import { createStudioRouter } from './router';
import { commonStore, consoleStore, schemaStore, iconGroupStore, modalStore } from './session';
import { fetcher } from '@studio/services/fetcher';
import { sessionRequests } from '@studio/services/sessionRequests';
import { loginReturnPath } from './paths';
import { App } from './App';
import type { IUserInfo } from '@vesoft-inc/ui-components/schema/types';
import type { ReactNode } from 'react';

vi.mock('./routes', () => ({ default: [{ path: '*', element: <div>page</div> }] }));
vi.mock('./AppProviders', () => ({ AppProviders: ({ children }: { children: ReactNode }) => children }));
vi.mock('@vesoft-inc/ui-components/modal', async (original) => ({
  ...(await original<object>()),
  GlobalModal: () => null,
}));

const user = (username: string): IUserInfo => ({
  username,
  address: 'db:9669',
  curSchemaPath: '/a',
  coreVersion: '',
  version: '',
  createdTime: '',
  roles: [],
});
const originalAdapter = fetcher.instance.defaults.adapter;
let application: ReturnType<typeof createStudioRouter> | undefined;

beforeEach(() => {
  window.APP_CONFIG = { basePath: '/studio/', defaultHost: '', defaultPort: '' };
  window.history.replaceState(null, '', '/studio/explorer/snapshots/example?mode=test#node-1');
  commonStore.invalidateSession();
  commonStore.setUserInfo(user('user-a'));
});
afterEach(() => {
  cleanup();
  application?.dispose();
  application = undefined;
  fetcher.instance.defaults.adapter = originalAdapter;
  commonStore.invalidateSession();
  delete window.APP_CONFIG;
  vi.restoreAllMocks();
});

describe('application session and router lifecycle', () => {
  it.each([HttpResCode.ErrSession, HttpResCode.ErrNoClient])(
    'cleans up expired sessions (%s) and returns under the basename after re-login',
    async (code) => {
      application = createStudioRouter();
      const destroyExplorer = vi.fn();
      commonStore.registerExplorerDestroy(destroyExplorer);
      const clearIcons = vi.spyOn(iconGroupStore, 'clear');
      consoleStore.setResultSnapshot('result-a', { snapshotId: 'snapshot-a', graph: 'graph-a' });
      consoleStore.updateEditorValue('MATCH (n) RETURN n');
      schemaStore.updateSchemas([{ name: 'a', path: '/a', owner: 'user-a' }]);
      schemaStore.updateCreateGraphModalInfo({ visible: true });
      modalStore.show({ title: 'Previous session confirmation' });
      const oldSignal = sessionRequests.signal;
      fetcher.instance.defaults.adapter = async (config) => {
        const expired = config.url === '/expired';
        const response = {
          config,
          status: expired ? 401 : 200,
          statusText: '',
          headers: { 'content-type': 'application/json' },
          data: JSON.stringify(
            expired ? { code } : { code: 0, data: config.url === '/nebula/userInfo' ? user('user-b') : {} }
          ),
        };
        if (expired) throw { config, response };
        return response;
      };
      await fetcher.get('/expired', undefined, { errTip: false });

      expect(oldSignal.aborted).toBe(true);
      expect(commonStore.userInfo).toBeUndefined();
      expect(consoleStore.getResultSnapshot('result-a')).toBeUndefined();
      expect(consoleStore.editorValue).toBe('');
      expect(schemaStore.schemas).toHaveLength(0);
      expect(schemaStore.createGraphModalInfo.visible).toBe(false);
      expect(modalStore.open).toBe(false);
      expect(destroyExplorer).toHaveBeenCalledOnce();
      expect(clearIcons).toHaveBeenCalledOnce();
      expect(application.router.state.location.pathname).toBe('/studio/login');
      const search = application.router.state.location.search;
      expect(new URLSearchParams(search).get('redirect')).toBe('/explorer/snapshots/example?mode=test#node-1');

      const success = await commonStore.login({ address: 'db', port: '9669', username: 'user-b', password: 'secret' });
      expect(success).toBe(true);
      await application.router.navigate(loginReturnPath(search, window.APP_CONFIG?.basePath));
      expect(commonStore.userInfo?.username).toBe('user-b');
      expect(application.router.state.location).toMatchObject({
        pathname: '/studio/explorer/snapshots/example',
        search: '?mode=test',
        hash: '#node-1',
      });
    }
  );

  it('ignores late authentication errors from a previous request scope', async () => {
    application = createStudioRouter();
    let reject!: () => void;
    fetcher.instance.defaults.adapter = (config) =>
      new Promise((_resolve, fail) => {
        reject = () =>
          fail({
            config,
            response: {
              config,
              status: 401,
              headers: { 'content-type': 'application/json' },
              data: JSON.stringify({ code: HttpResCode.ErrSession }),
            },
          });
      });
    const request = fetcher.get('/late');
    await vi.waitFor(() => expect(reject).toBeTypeOf('function'));
    commonStore.invalidateSession();
    commonStore.setUserInfo(user('user-b'));
    reject();
    expect((await request).data.code).toBe(499);
    expect(commonStore.userInfo?.username).toBe('user-b');
    expect(application.router.state.location.pathname).toBe('/studio/explorer/snapshots/example');
  });

  it('retains the original return address when authentication fails on Login', async () => {
    application = createStudioRouter();
    await application.router.navigate('/login?redirect=%2Fconsole');
    sessionRequests.expire(sessionRequests.signal);
    expect(application.router.state.location.search).toBe('?redirect=%2Fconsole');
  });

  it('preserves one router through rerenders and releases session navigation and history on disposal', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    application = createStudioRouter();
    const { router } = application;
    const view = render(<App router={router} />);
    await act(async () => {
      await router.navigate('/console');
    });
    view.rerender(<App router={router} />);
    expect(application.router).toBe(router);
    expect(router.state.location.pathname).toBe('/studio/console');
    await act(async () => commonStore.deps?.onLogout());
    expect(router.state.location.pathname).toBe('/studio/login');
    const state = router.state;
    const signal = sessionRequests.signal;
    view.unmount();
    application.dispose();
    application = undefined;
    sessionRequests.expire(signal);
    expect(commonStore.userInfo?.username).toBe('user-a');
    window.history.pushState(null, '', '/studio/after-dispose');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await Promise.resolve();
    expect(router.state).toBe(state);
    expect(remove.mock.calls.some(([type]) => type === 'popstate')).toBe(true);
  });
});
