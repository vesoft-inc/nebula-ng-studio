// @vitest-environment jsdom
import '@studio/test-support/routerEnvironment';
import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import routes from './routes';
import { App } from './App';

const behavior = vi.hoisted(() => ({ pending: null as Promise<void> | null, fail: false }));
vi.mock('./AppProviders', () => ({ AppProviders: ({ children }: { children: ReactNode }) => children }));
vi.mock('./SessionGate', () => ({ SessionGate: ({ children }: { children: ReactNode }) => children }));
vi.mock('./session', () => ({
  modalStore: {},
  commonStore: { userInfo: { address: 'db', username: 'a', curSchemaPath: '/a' }, setSchemaPath: vi.fn() },
  schemaStore: { currentSchema: { path: '/a' }, services: {} },
}));
vi.mock('@studio/components/PageHeader', () => ({ default: () => <header>Studio navigation</header> }));
vi.mock('@vesoft-inc/studio-ui-internal', () => ({ PageLoading: () => <div>loading page</div> }));
vi.mock('@studio/pages/Login', () => ({ default: () => <div>login page</div> }));
vi.mock('@studio/pages/Console', () => ({
  default: () => {
    if (behavior.fail) throw new Error('page failed');
    if (behavior.pending) throw behavior.pending;
    return <div>console page</div>;
  },
}));
vi.mock('@studio/services/schemaEditor', () => ({ createSchemaEditorServices: () => ({}) }));
vi.mock('@vesoft-inc/studio-ui-internal/schema', () => ({
  SchemaWorkbench: ({ view }: { view: unknown }) => <output>{JSON.stringify(view)}</output>,
}));
vi.mock('@vesoft-inc/studio-ui-internal/modal', () => ({ GlobalModal: () => <aside>global overlays</aside> }));
vi.mock('@vesoft-inc/studio-ui-internal/shell', () => ({
  StudioShell: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <>
      {header}
      <main>{children}</main>
    </>
  ),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let router: ReturnType<typeof createMemoryRouter> | undefined;
afterEach(() => {
  cleanup();
  router?.dispose();
  behavior.pending = null;
  behavior.fail = false;
  vi.restoreAllMocks();
});

it('keeps the shell and global overlays mounted while a page suspends', async () => {
  let finish!: () => void;
  behavior.pending = new Promise((resolve) => {
    finish = resolve;
  });
  router = createMemoryRouter(routes, { initialEntries: ['/console'] });
  render(<App router={router} />);
  await screen.findByText('loading page');
  expect(screen.getByText('Studio navigation')).toBeTruthy();
  expect(screen.getByText('global overlays')).toBeTruthy();
  await act(async () => {
    behavior.pending = null;
    finish();
  });
  expect(await screen.findByText('console page')).toBeTruthy();
});

it('contains page failures inside the shell and allows navigation to another page', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  behavior.fail = true;
  router = createMemoryRouter(routes, { initialEntries: ['/console'] });
  render(<App router={router} />);
  await screen.findByText('pageLoadFailed');
  expect(screen.getByText('Studio navigation')).toBeTruthy();
  expect(screen.getByText('global overlays')).toBeTruthy();
  await act(async () => {
    await router!.navigate('/schema-list');
    await vi.dynamicImportSettled();
  });
  expect((await screen.findByRole('status')).textContent).toBe('{"type":"schemas"}');
});

it.each([
  '/schema-manager/unknown/edit/books',
  '/schema-manager/graphtype/sketch/not-a-number',
  '/schema-manager/graphtype/edit/%',
])('redirects invalid Schema addresses before mounting their editor: %s', async (pathname) => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  router = createMemoryRouter(routes, { basename: '/studio', initialEntries: [`/studio${pathname}`] });
  render(<App router={router} />);
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  expect((await screen.findByRole('status')).textContent).toBe('{"type":"graph-types"}');
  expect(router.state.location.pathname).toBe('/studio/schema-manager/graphtype');
});

it('passes an encoded resource name to the workbench intact through the real router', async () => {
  const name = '电影/%2F?#';
  router = createMemoryRouter(routes, {
    initialEntries: [`/schema-manager/graphtype/edit/${encodeURIComponent(name)}`],
  });
  render(<App router={router} />);
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  expect(JSON.parse((await screen.findByRole('status')).textContent!)).toEqual({
    type: 'editor',
    mode: 'edit',
    graphTypeName: name,
  });
});
