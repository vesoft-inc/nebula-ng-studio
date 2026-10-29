import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GqlEditorProps } from '@vesoft-inc/studio-ui-internal/editor';
import type { ConsoleResult } from '@vesoft-inc/studio-ui-internal/console';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { StudioProvider } from './provider';
import { ConsoleWorkbench } from './console';
import type { QueryExecutor, StudioServices } from './services';

// Replace rendering engines only; the workbench, controller, service adapters and ownership are real.
vi.mock('../../studio-ui-internal/src/editor/GqlEditor', () => ({
  default: (props: GqlEditorProps) => (
    <textarea
      aria-label="Query"
      value={props.value}
      readOnly={props.readOnly}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  ),
}));
vi.mock('../../studio-ui-internal/src/editor/MonacoEditor', () => ({ default: () => null }));
vi.mock('@antv/layout-gpu', () => ({ FruchtermanLayout: class {} }));
vi.mock('../../studio-ui-internal/src/console/QueryResultList', async () => {
  const { observer } = await import('mobx-react-lite');
  return {
    default: observer(({ results }: { results: ConsoleResult[] }) => (
      <div>
        {results.map((result) => (
          <div key={result.id} data-testid="query-result">
            {result.gql}: {result.message}
          </div>
        ))}
      </div>
    )),
  };
});

beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(async () => {
  cleanup();
  await act(async () => {});
});
function fixture() {
  const execute = vi
    .fn<QueryExecutor>()
    .mockResolvedValue({ code: 1, message: 'result recorded', data: { tables: [] } });
  const query = vi.fn<QueryExecutor>().mockResolvedValue({ code: 0, message: '', data: { tables: [] } });
  const services: StudioServices = { console: { execute: execute as QueryExecutor, query: query as QueryExecutor } };
  return { execute, query, services };
}
function host(
  services: StudioServices,
  show = true,
  scopeKey = 'connection-a',
  schemaPath = '/one',
  children?: ReactNode
) {
  return (
    <StudioProvider scopeKey={scopeKey} services={services} schemaPath={schemaPath} locale="en_US">
      {show ? <ConsoleWorkbench loadGraphMetadata={false} /> : <div>Other page</div>}
      {children}
    </StudioProvider>
  );
}
describe('Studio session ownership', () => {
  it('does not call services until a workbench needs them', () => {
    const { services, execute, query } = fixture();
    render(host(services, false));
    expect(execute).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
  it('retains query text and results when the Console route unmounts', async () => {
    const { services } = fixture();
    const view = render(host(services));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Query' }), { target: { value: 'RETURN 1' } });
    fireEvent.click(screen.getByRole('button', { name: /run/i }));
    await screen.findByTestId('query-result');
    view.rerender(host(services, false));
    view.rerender(host(services));
    expect(((await screen.findByRole('textbox', { name: 'Query' })) as HTMLTextAreaElement).value).toBe('RETURN 1');
    expect(screen.getByTestId('query-result').textContent).toContain('result recorded');
  });
  it('keeps an in-flight query alive while its page is absent', async () => {
    const { services, execute } = fixture();
    let finish!: (value: ServerResponse<object>) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve as typeof finish;
        })
    );
    const view = render(host(services));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Query' }), { target: { value: 'RETURN 2' } });
    fireEvent.click(screen.getByRole('button', { name: /run/i }));
    const signal = execute.mock.calls[0][1]?.signal;
    view.rerender(host(services, false));
    expect(signal?.aborted).toBe(false);
    await act(async () => {
      finish({ code: 1, message: 'background result' });
    });
    view.rerender(host(services));
    await waitFor(() => expect(screen.getByTestId('query-result').textContent).toContain('background result'));
  });
  it.each(['scope', 'schema', 'service'] as const)(
    'cancels old queries when the %s changes and rejects their late results',
    async (change) => {
      const current = fixture();
      let finish!: (value: ServerResponse<object>) => void;
      current.execute.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve as typeof finish;
          })
      );
      const view = render(host(current.services));
      fireEvent.change(await screen.findByRole('textbox', { name: 'Query' }), { target: { value: 'RETURN 3' } });
      fireEvent.click(screen.getByRole('button', { name: /run/i }));
      const signal = current.execute.mock.calls[0][1]?.signal;
      const next = change === 'service' ? fixture().services : current.services;
      view.rerender(
        host(next, true, change === 'scope' ? 'connection-b' : 'connection-a', change === 'schema' ? '/two' : '/one')
      );
      await act(async () => {
        finish({ code: 1, message: 'old scope result' });
      });
      expect(signal?.aborted).toBe(true);
      await waitFor(() =>
        expect((screen.getByRole('textbox', { name: 'Query' }) as HTMLTextAreaElement).value).toBe('')
      );
      expect(screen.queryByTestId('query-result')).toBeNull();
    }
  );
  it('replaces a cached domain even when its page is absent', async () => {
    const first = fixture();
    const second = fixture();
    const view = render(host(first.services));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Query' }), { target: { value: 'old text' } });
    view.rerender(host(first.services, false));
    view.rerender(host(second.services, false));
    view.rerender(host(second.services));
    expect(((await screen.findByRole('textbox', { name: 'Query' })) as HTMLTextAreaElement).value).toBe('');
  });
  it('isolates providers and survives StrictMode setup replay', async () => {
    const { services } = fixture();
    const view = render(
      <StrictMode>
        {host(services)}
        {host(services, true, 'other')}
      </StrictMode>
    );
    const editors = await screen.findAllByRole('textbox', { name: 'Query' });
    fireEvent.change(editors[0], { target: { value: 'first only' } });
    expect((editors[1] as HTMLTextAreaElement).value).toBe('');
    view.rerender(
      <StrictMode>
        {host(services, false)}
        {host(services, true, 'other')}
      </StrictMode>
    );
    view.rerender(
      <StrictMode>
        {host(services)}
        {host(services, true, 'other')}
      </StrictMode>
    );
    expect((await screen.findAllByRole('textbox', { name: 'Query' }))[0]).toHaveProperty('value', 'first only');
  });
  it('aborts outstanding work when the provider is disposed', async () => {
    const { services, execute } = fixture();
    let finish!: (value: ServerResponse<object>) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve as typeof finish;
        })
    );
    const view = render(host(services));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Query' }), { target: { value: 'RETURN 4' } });
    fireEvent.click(screen.getByRole('button', { name: /run/i }));
    const signal = execute.mock.calls[0][1]?.signal;
    view.unmount();
    await act(async () => {
      finish({ code: 1, message: 'late' });
    });
    expect(signal?.aborted).toBe(true);
  });
});
