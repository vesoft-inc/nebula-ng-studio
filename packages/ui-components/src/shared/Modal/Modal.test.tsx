// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { UiProvider } from '../../provider';
import Modal from './Modal';

afterEach(cleanup);

it('keeps the default dialog accessible and restores focus after closing', async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <UiProvider renderGlobalModal={false}>
        <button onClick={() => setOpen(true)}>Open dialog</button>
        <Modal open={open} title="Create graph" onCancel={() => setOpen(false)}>
          <input aria-label="Graph name" autoFocus />
        </Modal>
      </UiProvider>
    );
  }
  const user = userEvent.setup();
  const { container } = render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Open dialog' });
  await user.click(trigger);

  const dialog = screen.getByRole('dialog', { name: 'Create graph' });
  expect(container.contains(dialog)).toBe(false);
  expect(dialog.closest('[aria-hidden="true"]')).toBeNull();
  await user.type(screen.getByRole('textbox', { name: 'Graph name' }), 'demo');
  await user.keyboard('{Escape}');

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('button', { name: 'Open dialog' })).toBe(trigger);
  expect(document.activeElement).toBe(trigger);
});

it('uses an explicit container without hiding the dialog', () => {
  function Harness() {
    const container = useRef<HTMLDivElement>(null);
    return (
      <UiProvider renderGlobalModal={false}>
        <div ref={container} data-testid="modal-container" />
        <Modal open title="Custom container" container={() => container.current}>
          <input aria-label="Name" />
        </Modal>
      </UiProvider>
    );
  }
  render(<Harness />);
  const dialog = screen.getByRole('dialog', { name: 'Custom container' });
  expect(screen.getByTestId('modal-container').contains(dialog)).toBe(true);
  expect(dialog.closest('[aria-hidden="true"]')).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Name' })).toBeDefined();
});
