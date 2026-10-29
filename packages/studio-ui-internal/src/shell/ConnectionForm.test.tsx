// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UiProvider } from '../provider';
import { ConnectionForm } from './ConnectionForm';

afterEach(cleanup);

describe('reusable connection form', () => {
  it('submits only its own form and prevents duplicate requests while connecting', async () => {
    let complete!: () => void;
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        })
    );
    const other = vi.fn();
    render(
      <UiProvider locale="en_US">
        <ConnectionForm
          defaultValues={{ username: 'alice', password: 'secret' }}
          showAddress={false}
          onSubmit={submit}
          labels={{ submit: 'First' }}
        />
        <ConnectionForm showAddress={false} onSubmit={other} labels={{ submit: 'Second' }} />
      </UiProvider>
    );
    const form = screen.getByRole('button', { name: 'First' }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    fireEvent.submit(form);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ username: 'alice', password: 'secret' }), {
      sso: false,
    });
    complete();
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' }).hasAttribute('disabled')).toBe(false));
  });

  it('releases the pending state after failure and permits retry', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce(undefined);
    render(
      <UiProvider locale="en_US">
        <ConnectionForm
          showAddress={false}
          defaultValues={{ username: 'alice', password: 'secret' }}
          onSubmit={submit}
          labels={{ submit: 'Connect' }}
        />
      </UiProvider>
    );
    fireEvent.submit(screen.getByRole('button', { name: 'Connect' }).closest('form')!);
    await screen.findByText('Connection failed');
    fireEvent.submit(screen.getByRole('button', { name: 'Connect' }).closest('form')!);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  });
});
