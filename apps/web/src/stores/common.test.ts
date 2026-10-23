// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommonStore } from './common';
import { connect, disconnect, fetchUserInfo } from '@studio/services';
import { sessionRequests } from '@studio/services/sessionRequests';
import type { IUserInfo } from '@studio/interfaces';

vi.mock('@studio/services', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  fetchUserInfo: vi.fn(),
  oauth2Connect: vi.fn(),
}));
vi.mock('@studio/utils/i18n', () => ({
  default: { language: 'en_US', on: vi.fn(), changeLanguage: vi.fn() },
  Language: { EN_US: 'en_US' },
}));
vi.mock('@vesoft-inc/utils', async (original) => ({
  ...(await original<object>()),
  encrypt: vi.fn(async () => 'token'),
}));

const user = (username = 'user-a', address = 'db:9669'): IUserInfo => ({
  username,
  address,
  curSchemaPath: '/a',
  coreVersion: '',
  version: '',
  createdTime: '',
  roles: [],
});
const payload = { address: 'db', port: '9669', username: 'user-b', password: 'secret' };

function createStore() {
  const store = new CommonStore();
  const deps = {
    iconGroupStore: { clear: vi.fn() },
    consoleStore: { clearConsole: vi.fn() },
    schemaStore: { reset: vi.fn() },
    onLogout: vi.fn(),
  };
  store.attach(deps);
  return { store, deps };
}

beforeEach(() => vi.clearAllMocks());

describe('session lifetime', () => {
  it('initializes explicitly and shares an in-flight identity check', async () => {
    const { store } = createStore();
    expect(fetchUserInfo).not.toHaveBeenCalled();
    let resolve!: (value: Awaited<ReturnType<typeof fetchUserInfo>>) => void;
    vi.mocked(fetchUserInfo).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const first = store.initializeSession();
    const second = store.initializeSession();
    expect(first).toBe(second);
    expect(store.sessionStatus).toBe('checking');
    resolve({ code: 0, message: '', data: user() });
    await expect(first).resolves.toBe(true);
    expect(store.isLogin).toBe(true);
    expect(fetchUserInfo).toHaveBeenCalledTimes(1);
  });

  it('cleans up expired session data and aborts its requests before a different user logs in', async () => {
    const { store, deps } = createStore();
    store.setUserInfo(user());
    const destroy = vi.fn();
    store.registerExplorerDestroy(destroy);
    const signal = sessionRequests.signal;
    const unsubscribe = sessionRequests.subscribe(store.invalidateSession);
    sessionRequests.expire(signal);
    unsubscribe();

    expect(signal.aborted).toBe(true);
    expect(store.userInfo).toBeUndefined();
    expect(store.sessionStatus).toBe('anonymous');
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(deps.iconGroupStore.clear).toHaveBeenCalledOnce();
    expect(deps.consoleStore.clearConsole).toHaveBeenCalledOnce();
    expect(deps.schemaStore.reset).toHaveBeenCalledOnce();

    vi.mocked(connect).mockResolvedValueOnce({ code: 0, message: '' });
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ code: 0, message: '', data: user('user-b') });
    await expect(store.login(payload)).resolves.toBe(true);
    expect(store.userInfo?.username).toBe('user-b');
    // Expiration events from the old request scope cannot clear the new session.
    sessionRequests.expire(signal);
    expect(store.userInfo?.username).toBe('user-b');
  });

  it('ignores an old userInfo response that arrives after re-login', async () => {
    const { store } = createStore();
    let resolve!: (value: Awaited<ReturnType<typeof fetchUserInfo>>) => void;
    vi.mocked(fetchUserInfo).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const oldCheck = store.initializeSession();
    vi.mocked(connect).mockResolvedValueOnce({ code: 0, message: '' });
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ code: 0, message: '', data: user('user-b') });
    await store.login(payload);
    resolve({ code: 0, message: '', data: user() });
    await expect(oldCheck).resolves.toBe(false);
    expect(store.userInfo?.username).toBe('user-b');
  });

  it('does not finish login until the identity request succeeds', async () => {
    const { store } = createStore();
    vi.mocked(connect).mockResolvedValueOnce({ code: 0, message: '' });
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ code: 500, message: 'failed' });
    await expect(store.login(payload)).resolves.toBe(false);
    expect(store.isLogin).toBe(false);
  });

  it('uses the same local cleanup on logout and connection changes', async () => {
    const { store, deps } = createStore();
    store.setUserInfo(user());
    store.setUserInfo(user('user-a', 'other-db:9669'));
    expect(deps.schemaStore.reset).toHaveBeenCalledTimes(1);
    vi.mocked(disconnect).mockResolvedValueOnce({ code: 0, message: '' });
    await store.logout();
    expect(store.userInfo).toBeUndefined();
    expect(deps.consoleStore.clearConsole).toHaveBeenCalledTimes(2);
    expect(deps.onLogout).toHaveBeenCalledOnce();
  });

  it('invalidates Console data only when the selected Schema changes', () => {
    const { store, deps } = createStore();
    store.setUserInfo(user());
    store.setSchemaPath('/a');
    expect(deps.consoleStore.clearConsole).not.toHaveBeenCalled();
    store.setSchemaPath('/b');
    expect(deps.consoleStore.clearConsole).toHaveBeenCalledOnce();
    expect(store.userInfo?.curSchemaPath).toBe('/b');
    expect(store.sessionStatus).toBe('authenticated');
    expect(deps.schemaStore.reset).not.toHaveBeenCalled();
  });
});
