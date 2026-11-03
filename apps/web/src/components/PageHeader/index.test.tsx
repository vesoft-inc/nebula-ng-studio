// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RouterProvider, useLocation } from '@tanstack/react-router';
import { createTestRouter } from '@studio/test-support/router';
import { routePaths } from '@studio/app/paths';
import { UiProvider } from '@vesoft-inc/studio-ui-internal/provider';
import PageHeader from './index';

vi.mock('@studio/app/session', () => ({
  commonStore: { userInfo: undefined, hasDarkMode: true, changeLanguage: vi.fn(), logout: vi.fn() },
}));
vi.mock('@studio/utils', () => ({ brandConfig: { consoleName: 'NebulaGraph' } }));

let router: ReturnType<typeof createTestRouter> | undefined;
afterEach(() => {
  cleanup();
});

function renderHeader(basename: string, pathname = '/console') {
  const prefix = basename.replace(/\/$/, '');
  function Layout() {
    const { pathname } = useLocation();
    return (
      <UiProvider locale="en_US">
        <PageHeader />
        <output>{pathname}</output>
      </UiProvider>
    );
  }
  router = createTestRouter(
    [
      { path: routePaths.console, element: null, staticData: { section: 'console' } },
      { path: routePaths.schema.schemas, element: null, staticData: { section: 'schema-manager' } },
      { path: routePaths.schema.graphTypes, element: null, staticData: { section: 'schema-manager' } },
      { path: '/schema-manager/graphs/$graphName', element: null, staticData: { section: 'schema-manager' } },
      { path: routePaths.explorer.snapshots, element: null, staticData: { section: 'explorer' } },
      { path: '/explorer/snapshots/$snapshotId', element: null, staticData: { section: 'explorer' } },
    ],
    { basepath: basename || '/', initialEntries: [`${prefix}${pathname}`], layout: Layout }
  );
  render(<RouterProvider router={router} />);
}

it.each(['', '/studio', '/studio/'])('keeps native links and router navigation under basename %j', async (basename) => {
  const prefix = basename.replace(/\/$/, '');
  renderHeader(basename);

  const schema = await screen.findByRole('tab', { name: 'Schema' });
  expect(schema.getAttribute('href')).toBe(`${prefix}/schema-manager/graphtype`);
  expect(screen.getByRole('tab', { name: 'Console' }).getAttribute('href')).toBe(`${prefix}/console`);
  expect(screen.getByRole('tab', { name: 'Explorer' }).getAttribute('href')).toBe(`${prefix}/explorer/snapshots`);

  // Modifier clicks must retain native link behavior without changing the current route.
  let interceptedByRouter = true;
  document.addEventListener(
    'click',
    (event) => {
      interceptedByRouter = event.defaultPrevented;
      event.preventDefault(); // jsdom cannot follow the native link after this assertion.
    },
    { once: true }
  );
  const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
  schema.dispatchEvent(modifiedClick);
  expect(interceptedByRouter).toBe(false);
  expect(screen.getByRole('status').textContent).toBe('/console');

  await act(async () => {
    fireEvent.click(schema);
  });
  expect(screen.getByRole('status').textContent).toBe('/schema-manager/graphtype');
  expect(schema.getAttribute('aria-selected')).toBe('true');
});

it.each([
  ['/console', 'Console'],
  ['/schema-list', 'Schema'],
  ['/schema-manager/graphs/books', 'Schema'],
  ['/explorer/snapshots/example', 'Explorer'],
])('selects the navigation section of the matched route: %s', async (pathname, label) => {
  renderHeader('/studio', pathname);
  await waitFor(() => expect(screen.getByRole('tab', { name: label }).getAttribute('aria-selected')).toBe('true'));
});
