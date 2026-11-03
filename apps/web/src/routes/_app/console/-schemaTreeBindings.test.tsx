// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { UiProvider } from '@vesoft-inc/studio-ui-internal/provider';
import { useSchemaTreeBindings } from './-schemaTreeBindings';
import { commonStore, schemaStore } from '@studio/app/session';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
}));
vi.mock('@studio/utils', () => ({ isGuiTarget: false }));
vi.mock('@studio/app/session', () => ({
  commonStore: { userInfo: { curSchemaPath: '/a' }, setSchemaPath: vi.fn() },
  schemaStore: {
    currentSchema: { path: '/a' },
    schemas: [],
    switchingSchema: false,
    switchSchema: vi.fn(),
    createSchema: vi.fn(),
    getSchemas: vi.fn(),
  },
}));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function renderBindings() {
  return renderHook(() => useSchemaTreeBindings(true), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <UiProvider locale="en_US" renderGlobalModal={false} cssBaseline={false}>
        {children}
      </UiProvider>
    ),
  });
}

it('switches Console Schema through the session lifecycle without a browser reload', async () => {
  vi.mocked(schemaStore.switchSchema).mockResolvedValueOnce({ code: 0, message: '' });
  const { result } = renderBindings();
  await expect(result.current.selector.onSwitchSchema({ path: '/b', name: 'b', owner: '' })).resolves.toBe(true);
  expect(commonStore.setSchemaPath).toHaveBeenCalledWith('/b');
  expect(navigate).not.toHaveBeenCalled();
});

it('keeps the current session Schema when a switch fails', async () => {
  vi.mocked(schemaStore.switchSchema).mockResolvedValueOnce({ code: 500, message: 'failed' });
  const { result } = renderBindings();
  await expect(result.current.selector.onSwitchSchema({ path: '/b', name: 'b', owner: '' })).resolves.toBe(false);
  expect(commonStore.setSchemaPath).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});

it('keeps lazy initial loading in the Studio adapter', () => {
  const { result } = renderBindings();
  expect(schemaStore.getSchemas).not.toHaveBeenCalled();
  result.current.onReady();
  expect(schemaStore.getSchemas).toHaveBeenCalledOnce();
  expect(result.current.showDetail).toBe(true);
  expect(result.current.selector.schemaLabel).toBe('a');
});

it('opens the Studio schema list after creation without switching the session', async () => {
  vi.mocked(schemaStore.createSchema).mockResolvedValueOnce({ code: 0, message: '' });
  const { result } = renderBindings();
  await expect(result.current.selector.onCreateSchema('/new')).resolves.toBe(true);
  expect(schemaStore.getSchemas).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledWith({ to: '/schema-list' });
  expect(commonStore.setSchemaPath).not.toHaveBeenCalled();
});

it('maps semantic tree actions to Studio routes', () => {
  const { result } = renderBindings();
  result.current.onCreateGraphType?.();
  expect(navigate).toHaveBeenLastCalledWith({ to: '/schema-manager/graphtype/create' });
  result.current.selector.onViewAllSchemas();
  expect(navigate).toHaveBeenLastCalledWith({ to: '/schema-list' });
});
