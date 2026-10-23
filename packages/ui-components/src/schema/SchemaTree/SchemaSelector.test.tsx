// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { UiProvider } from '../../provider';
import SchemaSelector from './SchemaSelector';

afterEach(cleanup);

it.each([true, false])('prevents repeated switches and unlocks after completion (success: %s)', async (success) => {
  let complete!: (value: boolean) => void;
  let fail!: (error: Error) => void;
  const onSwitchSchema = vi.fn(
    () =>
      new Promise<boolean>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      })
  );
  const view = render(
    <UiProvider locale="en_US">
      <SchemaSelector
        paperWidth={300}
        schemaLabel="Initial"
        schemas={[
          { name: 'first', path: '/first', owner: '' },
          { name: 'second', path: '/second', owner: '' },
        ]}
        collapsed={false}
        onSwitchSchema={onSwitchSchema}
        onCreateSchema={vi.fn()}
        onViewAllSchemas={vi.fn()}
      />
    </UiProvider>
  );
  const trigger = screen.getByRole('button', { name: 'Initial' });
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
  fireEvent.click(screen.getByText('/first'));
  fireEvent.click(screen.getByText('/second'));
  expect(onSwitchSchema).toHaveBeenCalledOnce();
  expect(screen.getByText('/second').closest('[role="button"]')?.getAttribute('aria-disabled')).toBe('true');
  await act(async () => {
    if (success) complete(true);
    else fail(new Error('switch failed'));
  });
  expect((trigger as HTMLButtonElement).disabled).toBe(false);
  if (!success) {
    fireEvent.click(screen.getByText('/second'));
    expect(onSwitchSchema).toHaveBeenCalledTimes(2);
    await act(async () => complete(true));
  }
  view.unmount();
});
