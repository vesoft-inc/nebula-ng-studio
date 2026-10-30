// @vitest-environment jsdom
import { transferableAbortController } from 'node:util';
import { act, createElement, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Outlet, RouterProvider } from 'react-router-dom';
import { createGuiRouter } from './router';

vi.mock('@gui/components/PageLayout', () => ({
  default: () => createElement('section', null, 'GUI shell', createElement(Outlet)),
}));
vi.mock('@gui/pages/Console', () => ({ default: () => createElement('main', null, 'GUI console') }));
const applications: ReturnType<typeof createGuiRouter>[] = [];
let root: Root | undefined;
beforeEach(() => {
  const controller = transferableAbortController();
  vi.stubGlobal('AbortController', controller.constructor);
  vi.stubGlobal('AbortSignal', controller.signal.constructor);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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
function application() {
  const result = createGuiRouter();
  applications.push(result);
  return result;
}
describe('GUI application router lifecycle', () => {
  it('navigates under the basename and releases its history listener on disposal', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const app = application();
    await app.router.navigate('/ui/console?query=1');
    expect(window.location.pathname).toBe('/gui/ui/console');
    expect(app.router.state.location.pathname).toBe('/gui/ui/console');
    expect(app.router.state.location.search).toBe('?query=1');
    const state = app.router.state;
    app.dispose();
    expect(remove.mock.calls.some(([type]) => type === 'popstate')).toBe(true);
    window.history.pushState(null, '', '/gui/after');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await Promise.resolve();
    expect(app.router.state).toBe(state);
  });

  it.each(['/ui/console', '/ui', '/ui/', '/ui/unknown', '/ui/console/extra', '/', '/unknown'])(
    'renders the console under the basename without adding redirect history entries: %s',
    async (pathname) => {
      window.history.replaceState(null, '', `/gui${pathname}`);
      const historyLength = window.history.length;
      const app = application();
      const container = document.createElement('div');
      root = createRoot(container);
      await act(async () => {
        root!.render(
          createElement(
            Suspense,
            { fallback: 'Loading console' },
            createElement(RouterProvider, { router: app.router, future: { v7_startTransition: true } })
          )
        );
      });
      await act(async () => {
        await vi.dynamicImportSettled();
      });
      expect(window.location.pathname).toBe('/gui/ui/console');
      expect(window.history.length).toBe(historyLength);
      expect(container.querySelector('section')?.textContent).toContain('GUI shell');
      expect(container.querySelector('main')?.textContent).toBe('GUI console');
    }
  );
});
