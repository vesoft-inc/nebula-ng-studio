// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, Outlet, RouterProvider } from '@tanstack/react-router';
import { createGuiRouter } from './router';

vi.mock('@gui/components/PageLayout', () => ({
  default: () => createElement('section', null, 'GUI shell', createElement(Outlet)),
}));
vi.mock('@gui/routes/ui/console/-Page', () => ({ default: () => createElement('main', null, 'GUI console') }));
vi.mock('@vesoft-inc/studio-ui-internal', () => ({ PageLoading: () => createElement('div', null, 'Loading console') }));

const applications: ReturnType<typeof createGuiRouter>[] = [];
let root: Root | undefined;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  window.APP_CONFIG = { basePath: '/gui/', defaultHost: '', defaultPort: '' };
  window.history.replaceState(null, '', '/gui/ui/console');
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  applications.splice(0).forEach((application) => application.dispose());
  delete window.APP_CONFIG;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function application(options?: Parameters<typeof createGuiRouter>[0]) {
  const result = createGuiRouter(options);
  applications.push(result);
  return result;
}

async function mount(app: ReturnType<typeof createGuiRouter>) {
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <StrictMode>
        <RouterProvider router={app.router} />
      </StrictMode>
    );
    await app.router.load();
    await vi.dynamicImportSettled();
  });
  return container;
}

describe('GUI application router lifecycle', () => {
  it('keeps one router across rerenders and releases its history listener on disposal', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const app = application();
    await mount(app);
    await act(async () => {
      await app.router.navigate({ to: '/ui/console', search: { query: 1 }, hash: 'result' });
    });
    expect(window.location.pathname).toBe('/gui/ui/console');
    expect(window.location.search).toBe('?query=1');
    expect(window.location.hash).toBe('#result');
    expect(app.router.state.location).toMatchObject({
      pathname: '/ui/console',
      searchStr: '?query=1',
      hash: 'result',
    });
    const router = app.router;
    await act(async () => {
      root!.render(
        <StrictMode>
          <RouterProvider router={app.router} />
        </StrictMode>
      );
    });
    expect(app.router).toBe(router);
    const state = router.state;
    act(() => root!.unmount());
    root = undefined;
    app.dispose();
    expect(remove.mock.calls.some(([type]) => type === 'popstate')).toBe(true);
    const removed = remove.mock.calls.length;
    app.dispose();
    expect(remove.mock.calls).toHaveLength(removed);
    window.history.pushState(null, '', '/gui/after');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await Promise.resolve();
    expect(router.state).toBe(state);
  });

  describe.each(['', '/gui'])('basepath=%s', (basepath) => {
    it.each(['/ui/console', '/ui', '/ui/', '/ui/unknown', '/ui/console/extra', '/', '/unknown'])(
      'renders the console without adding redirect history entries: %s',
      async (pathname) => {
        window.APP_CONFIG!.basePath = basepath;
        window.history.replaceState(null, '', `${basepath}${pathname}`);
        const historyLength = window.history.length;
        const app = application();
        const container = await mount(app);
        expect(window.location.pathname).toBe(`${basepath}/ui/console`);
        expect(window.history.length).toBe(historyLength);
        expect(container.querySelector('section')?.textContent).toContain('GUI shell');
        expect(container.querySelector('main')?.textContent).toBe('GUI console');
      }
    );
  });

  it('leaves an injected history under its caller ownership', async () => {
    const history = createMemoryHistory({ initialEntries: ['/ui/console'] });
    const destroy = vi.spyOn(history, 'destroy');
    const app = application({ history, basepath: '' });
    const container = await mount(app);
    expect(container.querySelector('main')?.textContent).toBe('GUI console');
    act(() => root!.unmount());
    root = undefined;
    app.dispose();
    expect(destroy).not.toHaveBeenCalled();
    history.destroy();
  });
});
