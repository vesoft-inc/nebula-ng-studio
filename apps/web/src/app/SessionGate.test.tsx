// @vitest-environment jsdom
import '@studio/test-support/routerEnvironment';
import { StrictMode, useEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { SessionGate } from './SessionGate';
import { commonStore } from './session';
import { fetchUserInfo } from '@studio/services';
import type { IUserInfo } from '@studio/interfaces';

vi.mock('@studio/services', () => ({
  fetchUserInfo: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  oauth2Connect: vi.fn(),
}));
vi.mock('./session', async () => {
  const { CommonStore } = await import('@studio/stores/common');
  return { commonStore: new CommonStore() };
});
vi.mock('@studio/components/PageLoading', () => ({ default: () => <div>checking session</div> }));

afterEach(cleanup);
const user = (username = 'a') => ({ username, address: 'db:9669', curSchemaPath: '/a' }) as IUserInfo;

describe('protected page initialization', () => {
  it('waits for identity before mounting a protected page, including StrictMode effect replay', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof fetchUserInfo>>) => void;
    vi.mocked(fetchUserInfo).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const initializePage = vi.fn();
    const destroyPage = vi.fn();
    function Page() {
      useEffect(() => {
        initializePage();
        return destroyPage;
      }, []);
      return <div>protected page</div>;
    }
    const router = createMemoryRouter([
      {
        path: '*',
        element: (
          <SessionGate>
            <Page />
          </SessionGate>
        ),
      },
    ]);
    const view = render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>
    );
    expect(screen.getByText('checking session')).toBeTruthy();
    expect(initializePage).not.toHaveBeenCalled();
    expect(fetchUserInfo).toHaveBeenCalledOnce();
    await act(async () => resolve({ code: 0, message: '', data: user() }));
    expect(screen.getByText('protected page')).toBeTruthy();
    expect(initializePage).toHaveBeenCalled();
    const mounted = initializePage.mock.calls.length;
    act(() => commonStore.setUserInfo(user('b')));
    expect(destroyPage).toHaveBeenCalled();
    expect(initializePage.mock.calls.length).toBeGreaterThan(mounted);
    view.unmount();
    router.dispose();
  });

  it('unmounts protected pages when invalidated and preserves an application-relative return URL', async () => {
    commonStore.setUserInfo(user());
    const destroyed = vi.fn();
    function Page() {
      useEffect(() => () => destroyed(), []);
      return <div>protected page</div>;
    }
    function Login() {
      return <output>{useLocation().search}</output>;
    }
    const router = createMemoryRouter(
      [
        {
          path: '/console',
          element: (
            <SessionGate>
              <Page />
            </SessionGate>
          ),
        },
        { path: '/login', element: <Login /> },
      ],
      { basename: '/studio', initialEntries: ['/studio/console?q=1#result'] }
    );
    render(<RouterProvider router={router} />);
    await act(async () => commonStore.invalidateSession());
    expect(screen.queryByText('protected page')).toBeNull();
    expect(destroyed).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/studio/login');
    expect(new URLSearchParams(router.state.location.search).get('redirect')).toBe('/console?q=1#result');
    router.dispose();
  });
});
