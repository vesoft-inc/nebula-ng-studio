// @vitest-environment jsdom
import { useEffect, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryHistory } from '@tanstack/react-router';
import { createStudioRouter } from './router';
import { App } from './App';
import { UiProvider } from '@vesoft-inc/studio-ui-internal/provider';

const behavior = vi.hoisted(() => ({ pending: null as Promise<void> | null, fail: false }));
const lifecycle = vi.hoisted(() => ({
  created: vi.fn(),
  destroyed: vi.fn(),
  createSucceeded: undefined as (() => void) | undefined,
}));
vi.mock('./AppProviders', () => ({
  AppProviders: ({ children }: { children: ReactNode }) => (
    <UiProvider locale="en_US" renderGlobalModal={false}>
      {children}
    </UiProvider>
  ),
}));
vi.mock('./SessionGate', () => ({ SessionGate: ({ children }: { children: ReactNode }) => children }));
vi.mock('./session', () => ({
  modalStore: {},
  bindSessionLifecycle: () => () => {},
  commonStore: { userInfo: { address: 'db', username: 'a', curSchemaPath: '/a' }, setSchemaPath: vi.fn() },
  schemaStore: {
    currentSchema: { path: '/a' },
    createGraphModalInfo: {},
    getSchemas: vi.fn(),
    updateGraphTypesBySchema: vi.fn(),
    updateGraphsBySchema: vi.fn(),
  },
}));
vi.mock('@studio/components/PageHeader', () => ({ default: () => <header>Studio navigation</header> }));
vi.mock('@studio/routes/_app/_schema/schema-manager/-Sidebar', () => ({
  default: () => <aside>Schema navigation</aside>,
}));
vi.mock('@vesoft-inc/studio-ui-internal', () => ({ PageLoading: () => <div>loading page</div> }));
vi.mock('@studio/routes/login/-Page', () => ({ default: () => <div>login page</div> }));
vi.mock('@studio/routes/_app/console/-Page', () => ({
  default: () => {
    if (behavior.fail) throw new Error('page failed');
    if (behavior.pending) throw behavior.pending;
    return <div>console page</div>;
  },
}));
vi.mock('@studio/services/schemaEditor', () => ({ createSchemaEditorServices: () => ({}) }));
vi.mock('@vesoft-inc/studio-ui-internal/schema-editor/model', () => ({
  SchemaEditorController: class {
    constructor() {
      lifecycle.created();
    }
    destroy() {
      lifecycle.destroyed();
    }
  },
}));
vi.mock('@vesoft-inc/studio-ui-internal/schema', () => ({
  SchemaProvider: ({ children }: { children: ReactNode }) => children,
  CreateGraphDialog: ({ onOk }: { onOk: () => void }) => {
    lifecycle.createSucceeded = onOk;
    return null;
  },
  SchemaList: ({ onOpen }: any) => (
    <>
      <output>schemas</output>
      <button onClick={() => onOpen({ path: '/a' })}>Open schema</button>
    </>
  ),
  GraphTypeList: ({ onEdit }: any) => (
    <>
      <output>graph-types</output>
      <button onClick={() => onEdit('电影/%2F?#')}>Edit type</button>
    </>
  ),
  GraphList: ({ onView }: any) => (
    <>
      <output>graphs</output>
      <button onClick={() => onView('电影/%2F?#')}>Open graph</button>
    </>
  ),
  GraphInfo: ({ graphName, onBack }: any) => (
    <>
      <output>{JSON.stringify({ type: 'graph', name: graphName })}</output>
      <button onClick={onBack}>Back</button>
    </>
  ),
}));
vi.mock('@vesoft-inc/studio-ui-internal/schema-editor', () => ({
  SchemaEditorProvider: ({ children }: { children: ReactNode }) => children,
  SketchList: ({ onOpen }: any) => (
    <>
      <output>sketches</output>
      <button onClick={() => onOpen(42)}>Open sketch</button>
    </>
  ),
  SchemaEditor: ({ mode, graphTypeName, sketchId, onBack }: any) => (
    <>
      <output>{JSON.stringify({ type: 'editor', mode, graphTypeName, sketchId })}</output>
      <button onClick={onBack}>Back</button>
    </>
  ),
}));
vi.mock('@studio/routes/_app/explorer/-Layout', async () => {
  const { Outlet } = await import('@tanstack/react-router');
  return { default: Outlet };
});
vi.mock('@vesoft-inc/studio-ui-internal/explorer', () => ({
  SnapshotList: ({ onOpen }: any) => (
    <>
      <output>snapshots</output>
      <button onClick={() => onOpen('snapshot/%2F')}>Open snapshot</button>
    </>
  ),
  ExplorerGraph: ({ snapshotId, onDirtyChange, onBack, blocker }: any) => {
    useEffect(() => {
      onDirtyChange(false);
      return () => onDirtyChange(false);
    }, [onDirtyChange]);
    return (
      <>
        <output>{snapshotId}</output>
        <button onClick={() => onDirtyChange(true)}>Change graph</button>
        <button onClick={onBack}>Back</button>
        {blocker.state === 'blocked' && (
          <div role="dialog">
            <button onClick={blocker.reset}>Stay</button>
            <button onClick={blocker.proceed}>Leave</button>
          </div>
        )}
      </>
    );
  },
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
vi.mock('react-i18next', async (original) => ({
  ...(await original<object>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

let application: ReturnType<typeof createStudioRouter>;
async function open(path: string, basepath = '') {
  application = createStudioRouter({
    basepath,
    history: createMemoryHistory({ initialEntries: [`${basepath}${path}`] }),
  });
  render(<App router={application.router} />);
  await act(async () => {
    await application.router.load();
  });
  return application.router;
}
afterEach(() => {
  cleanup();
  application?.dispose();
  behavior.pending = null;
  behavior.fail = false;
  lifecycle.created.mockClear();
  lifecycle.destroyed.mockClear();
  vi.restoreAllMocks();
});
it('keeps the shell and overlays visible while a page suspends', async () => {
  let finish!: () => void;
  behavior.pending = new Promise((resolve) => {
    finish = resolve;
  });
  await open('/console');
  expect(await screen.findByText('loading page')).toBeTruthy();
  expect(screen.getByText('Studio navigation')).toBeTruthy();
  expect(screen.getByText('global overlays')).toBeTruthy();
  await act(async () => {
    behavior.pending = null;
    finish();
  });
  expect(await screen.findByText('console page')).toBeTruthy();
});
it('contains a page error and lets the host navigate to another leaf', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  behavior.fail = true;
  const router = await open('/console');
  expect(await screen.findByText('pageLoadFailed')).toBeTruthy();
  expect(screen.getByText('Studio navigation')).toBeTruthy();
  await act(async () => {
    await router.navigate({ to: '/schema-list' });
  });
  expect((await screen.findByRole('status')).textContent).toBe('schemas');
});
it.each([
  ['/schema-list', 'schemas'],
  ['/schema-manager/graphtype', 'graph-types'],
  ['/schema-manager/graphs', 'graphs'],
  ['/schema-manager/graphtype/sketch', 'sketches'],
  ['/schema-manager/graphtype/sketch/42', '{"type":"editor","mode":"sketch","sketchId":42}'],
  ['/schema-manager/graphtype/create', '{"type":"editor","mode":"create"}'],
  ['/explorer/snapshots', 'snapshots'],
  ['/explorer/snapshots/saved', 'saved'],
])('mounts the independent component at %s', async (path, expected) => {
  await open(path);
  expect((await screen.findByRole('status')).textContent).toBe(expected);
});
it.each([
  'unknown/edit/books',
  'graphtype/create/extra',
  'graphtype/edit/books/extra',
  'graphtype/sketch/no',
  'graphtype/sketch/0',
  'graphtype/sketch/9007199254740992',
  'graphtype/edit/%',
  'graphtype/edit/%E0%A4%A',
])('redirects an invalid Schema route: %s', async (path) => {
  const router = await open(`/schema-manager/${path}`, '/studio');
  expect((await screen.findByRole('status')).textContent).toBe('graph-types');
  expect(router.state.location.pathname).toBe('/schema-manager/graphtype');
  expect(router.history.location.pathname).toBe('/studio/schema-manager/graphtype');
});
it.each(['graphs', 'graphtype/edit', 'graphtype/view'])('decodes resource names once through %s', async (section) => {
  const name = '电影/%2F?#';
  await open(`/schema-manager/${section}/${encodeURIComponent(name)}/?tab=info#details`, '/studio');
  const value = JSON.parse((await screen.findByRole('status')).textContent!);
  expect(value.name ?? value.graphTypeName).toBe(name);
});
it('navigates between independent Schema pages while retaining the host session', async () => {
  const router = await open('/schema-list', '/studio');
  fireEvent.click(await screen.findByText('Open schema'));
  fireEvent.click(await screen.findByText('Edit type'));
  await waitFor(() =>
    expect(router.history.location.pathname).toBe(
      `/studio/schema-manager/graphtype/edit/${encodeURIComponent('电影/%2F?#')}`
    )
  );
  expect(JSON.parse(screen.getByRole('status').textContent!).graphTypeName).toBe('电影/%2F?#');
  fireEvent.click(screen.getByText('Back'));
  expect(await screen.findByText('Edit type')).toBeTruthy();
  expect(lifecycle.created).toHaveBeenCalledOnce();
  expect(lifecycle.destroyed).not.toHaveBeenCalled();
});
it('keeps dirty snapshot navigation in the host, including cancel, proceed, and history back', async () => {
  const router = await open('/explorer/snapshots', '/studio');
  fireEvent.click(await screen.findByText('Open snapshot'));
  expect(await screen.findByText('snapshot/%2F')).toBeTruthy();
  fireEvent.click(screen.getByText('Change graph'));
  fireEvent.click(screen.getByText('Back'));
  fireEvent.click(await screen.findByText('Stay'));
  expect(screen.getByText('snapshot/%2F')).toBeTruthy();
  act(() => router.history.back());
  fireEvent.click(await screen.findByText('Leave'));
  expect(await screen.findByText('Open snapshot')).toBeTruthy();
});

it('ignores a completed graph creation after leaving the Schema session', async () => {
  const router = await open('/schema-list');
  const complete = lifecycle.createSucceeded!;
  await act(async () => {
    await router.navigate({ to: '/console' });
  });
  act(() => complete());
  expect(router.state.location.pathname).toBe('/console');
  expect(screen.getByText('console page')).toBeTruthy();
});
