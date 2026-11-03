// @vitest-environment jsdom
import { Fragment, StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RouterProvider } from '@tanstack/react-router';
import { createTestRouter } from '@studio/test-support/router';
import { UiProvider } from '@vesoft-inc/studio-ui-internal/provider';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { SchemaServices } from '@vesoft-inc/studio-ui-internal/schema/model';
import { schemaStore } from '@studio/app/session';
import { useSchemaTreeBindings } from './-schemaTreeBindings';

const execute = vi.hoisted(() => vi.fn<SchemaServices['execute']>());
vi.mock('@studio/utils', () => ({ isGuiTarget: false }));
vi.mock('@studio/app/session', async () => {
  const { SchemaController } = await import('@vesoft-inc/studio-ui-internal/schema/model');
  return {
    commonStore: { userInfo: { curSchemaPath: '/initial' }, setSchemaPath: vi.fn() },
    schemaStore: new SchemaController({ execute: execute as SchemaServices['execute'] }),
  };
});

let router: ReturnType<typeof createTestRouter> | undefined;
beforeEach(() => {
  execute.mockReset();
  schemaStore.reset();
  schemaStore.updateCurrentSchame({ path: '/initial' });
});
afterEach(() => {
  cleanup();
  schemaStore.destroy();
});

it.each([false, true])(
  'keeps the selected route when a creation refresh finishes after leaving Console (StrictMode=%s)',
  async (strict) => {
    let finish!: (response: ServerResponse<object>) => void;
    let pending!: Promise<boolean>;
    execute.mockResolvedValueOnce({ code: 0, message: '' });
    execute.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    function Create() {
      const bindings = useSchemaTreeBindings(true);
      return (
        <button
          onClick={() => {
            pending = bindings.selector.onCreateSchema('/new');
          }}
        >
          Create schema
        </button>
      );
    }
    router = createTestRouter(
      [
        { path: '/console', element: <Create /> },
        { path: '/other', element: <div>Other page</div> },
        { path: '/schema-list', element: <div>Schema list</div> },
      ],
      { initialEntries: ['/console'] }
    );
    const Wrapper = strict ? StrictMode : Fragment;
    render(
      <Wrapper>
        <UiProvider locale="en_US" renderGlobalModal={false}>
          <RouterProvider router={router} />
        </UiProvider>
      </Wrapper>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Create schema' }));
    await waitFor(() => expect(execute.mock.calls.map(([gql]) => gql)).toContain('SHOW SCHEMAS'));
    await act(async () => {
      await router!.navigate({ href: '/other' });
    });
    expect(screen.getByText('Other page')).toBeTruthy();

    await act(async () => {
      finish({ code: 0, message: '', data: { tables: [] } });
      await expect(pending).resolves.toBe(true);
    });
    expect(router.state.location.pathname).toBe('/other');
    expect(screen.getByText('Other page')).toBeTruthy();
  }
);
