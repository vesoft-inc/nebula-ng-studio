// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { UiProvider } from '@vesoft-inc/studio-ui-internal/provider';
import { SchemaController } from '@vesoft-inc/studio-ui-internal/schema/model';
import { SchemaProvider } from '@vesoft-inc/studio-ui-internal/schema';
import { RouterProvider } from '@tanstack/react-router';
import { createTestRouter } from '@studio/test-support/router';
import { commonStore } from '@studio/app/session';
import SchemaSidebar from './-Sidebar';
const state = vi.hoisted(() => ({ controller: undefined as SchemaController | undefined }));
vi.mock('@studio/app/session', () => ({
  commonStore: { setSchemaPath: vi.fn() },
  get schemaStore() {
    return state.controller;
  },
}));

afterEach(cleanup);

it.each([true, false])('navigates to graph types only after a successful switch (success: %s)', async (success) => {
  const execute = vi.fn();
  const switchSchema = vi.fn().mockResolvedValue({ code: success ? 0 : 500, message: '' });
  const controller = new SchemaController({ execute, switchSchema });
  controller.updateCurrentSchame({ path: '/initial' });
  controller.updateSchemas([{ path: '/next', name: 'next', owner: '' }]);
  state.controller = controller;
  vi.mocked(commonStore.setSchemaPath).mockClear();
  const router = createTestRouter(
    [
      { path: '/schema-manager/graphs', element: <SchemaSidebar /> },
      { path: '/schema-manager/graphtype', element: <SchemaSidebar /> },
    ],
    { initialEntries: ['/schema-manager/graphs'] }
  );
  const view = render(
    <UiProvider locale="en_US" renderGlobalModal={false}>
      <SchemaProvider value={controller}>
        <RouterProvider router={router} />
      </SchemaProvider>
    </UiProvider>
  );
  try {
    expect(execute).not.toHaveBeenCalled();
    const trigger = await screen.findByRole('button', { name: 'initial' });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 40,
      top: 0,
      left: 0,
      bottom: 40,
      right: 300,
      x: 0,
      y: 0,
      toJSON() {},
    });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('/next'));
    await waitFor(() => expect(switchSchema).toHaveBeenCalledWith('/next'));
    await waitFor(() => expect(controller.switchingSchema).toBe(false));

    if (success) {
      await waitFor(() => expect(router.state.location.pathname).toBe('/schema-manager/graphtype'));
      expect(commonStore.setSchemaPath).toHaveBeenCalledOnce();
      expect(commonStore.setSchemaPath).toHaveBeenCalledWith('/next');
      expect(await screen.findByRole('button', { name: 'next' })).toBeTruthy();
    } else {
      expect(router.state.location.pathname).toBe('/schema-manager/graphs');
      expect(commonStore.setSchemaPath).not.toHaveBeenCalled();
      expect(controller.currentSchema.path).toBe('/initial');
    }
  } finally {
    view.unmount();
    controller.destroy();
  }
});
