// @vitest-environment jsdom
import { transferableAbortController } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuiRouter } from './router';

vi.mock('@gui/routes', () => ({ default: [{ path: '*' }] }));
const applications: ReturnType<typeof createGuiRouter>[] = [];
beforeEach(() => {
  const controller = transferableAbortController();
  vi.stubGlobal('AbortController', controller.constructor);
  vi.stubGlobal('AbortSignal', controller.signal.constructor);
  window.APP_CONFIG = { basePath: '/gui/', defaultHost: '', defaultPort: '' };
  window.history.replaceState(null, '', '/gui/console');
});
afterEach(() => {
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
    await app.router.navigate('/login');
    expect(window.location.pathname).toBe('/gui/login');
    expect(app.router.state.location.pathname).toBe('/gui/login');
    const state = app.router.state;
    app.dispose();
    expect(remove.mock.calls.some(([type]) => type === 'popstate')).toBe(true);
    window.history.pushState(null, '', '/gui/after');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await Promise.resolve();
    expect(app.router.state).toBe(state);
  });
});
