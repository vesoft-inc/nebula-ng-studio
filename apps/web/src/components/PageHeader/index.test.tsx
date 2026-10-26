// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { UiProvider } from '@vesoft-inc/ui-components/provider';
import PageHeader from './index';

vi.mock('@studio/app/session', () => ({
  commonStore: { userInfo: undefined, hasDarkMode: true, changeLanguage: vi.fn(), logout: vi.fn() },
}));
vi.mock('@studio/utils', () => ({ brandConfig: { consoleName: 'NebulaGraph' } }));

afterEach(cleanup);

it.each(['', '/studio', '/studio/'])('keeps native links and router navigation under basename %j', (basename) => {
  const prefix = basename.replace(/\/$/, '');
  function Location() {
    return <output>{useLocation().pathname}</output>;
  }
  render(
    <MemoryRouter basename={basename || '/'} initialEntries={[`${prefix}/console`]}>
      <UiProvider locale="en_US">
        <PageHeader />
        <Location />
      </UiProvider>
    </MemoryRouter>
  );

  const schema = screen.getByRole('tab', { name: 'Schema' });
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

  fireEvent.click(schema);
  expect(screen.getByRole('status').textContent).toBe('/schema-manager/graphtype');
});
