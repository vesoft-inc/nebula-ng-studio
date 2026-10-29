// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { UiProvider } from '../provider';
import SchemaController from './SchemaController';
import { SchemaProvider } from './context';
import { SchemaSidebar } from './SchemaSidebar';

afterEach(cleanup);

it.each([true, false])('navigates to graph types only after a successful switch (success: %s)', async (success) => {
  const execute = vi.fn();
  const switchSchema = vi.fn().mockResolvedValue({ code: success ? 0 : 500, message: '' });
  const controller = new SchemaController({ execute, switchSchema });
  controller.updateCurrentSchame({ path: '/initial' });
  controller.updateSchemas([{ path: '/next', name: 'next', owner: '' }]);
  const onNavigate = vi.fn();
  const onSchemaChange = vi.fn();
  const view = render(
    <UiProvider locale="en_US" renderGlobalModal={false}>
      <SchemaProvider value={controller}>
        <SchemaSidebar onNavigate={onNavigate} onSchemaChange={onSchemaChange} />
      </SchemaProvider>
    </UiProvider>
  );
  try {
    expect(execute).not.toHaveBeenCalled();
    const trigger = screen.getByRole('button', { name: 'initial' });
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
      expect(onNavigate).toHaveBeenCalledOnce();
      expect(onNavigate).toHaveBeenCalledWith({ type: 'graph-types' });
      expect(onSchemaChange).toHaveBeenCalledOnce();
      expect(onSchemaChange).toHaveBeenCalledWith('/next');
      expect(await screen.findByRole('button', { name: 'next' })).toBeTruthy();
    } else {
      expect(onNavigate).not.toHaveBeenCalled();
      expect(onSchemaChange).not.toHaveBeenCalled();
      expect(controller.currentSchema.path).toBe('/initial');
    }
  } finally {
    view.unmount();
    controller.destroy();
  }
});
