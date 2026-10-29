import { createRef, useCallback, useEffect, useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioProvider, UiProvider } from './provider';
import { SchemaWorkbench, SchemaTree, SchemaItemType } from './schema';
import { SchemaEditorWorkbench } from './schema-editor';
import { ExplorerWorkbench } from './explorer';
import { GqlEditor, GqlViewer, type GqlEditorHandle } from './editor';
import type { GqlEditorProps } from '@vesoft-inc/studio-ui-internal/editor';
import type { QueryExecutor, StudioServices } from './services';

// Browser rendering engines are replaced; workbenches and their service/state lifecycles are real.
vi.mock('@antv/layout-gpu', () => ({ FruchtermanLayout: class {} }));
vi.mock('../../studio-ui-internal/src/editor/MonacoEditor', () => ({ default: () => null }));
vi.mock('../../studio-ui-internal/src/editor/GqlEditor', () => ({
  default: function Editor(props: GqlEditorProps) {
    const input = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
      props.onReady?.({ focus: () => input.current?.focus() } as never);
      return () => props.onReady?.(undefined);
    }, [props.onReady]);
    return (
      <textarea
        ref={input}
        aria-label="Query"
        value={props.value}
        readOnly={props.readOnly}
        onChange={(event) => props.onChange?.(event.target.value)}
      />
    );
  },
}));
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(async () => {
  cleanup();
  await act(async () => {});
  vi.unstubAllGlobals();
});

function fixture() {
  const execute = vi.fn<QueryExecutor>().mockResolvedValue({ code: 0, message: '', data: { tables: [] } });
  const list = vi.fn().mockResolvedValue({ code: 0, data: { items: [], total: 0, page: 1, pageSize: 10 } });
  const services: StudioServices = {
    schema: { execute: execute as QueryExecutor },
    schemaEditor: { execute: execute as QueryExecutor },
    explorer: {
      execute: execute as QueryExecutor,
      snapshots: { list, read: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    },
  };
  return { services, execute, list };
}

describe('Host-independent workbenches', () => {
  it.each(['schema', 'schema-editor', 'explorer'])(
    'mounts %s without a router or optional persistence services',
    async (kind) => {
      const { services, list } = fixture();
      const dirty = vi.fn();
      const view = render(
        <StudioProvider scopeKey="session" schemaPath="/one" services={services} locale="en_US">
          {kind === 'schema' ? (
            <SchemaWorkbench sidebar={null} />
          ) : kind === 'schema-editor' ? (
            <SchemaEditorWorkbench mode="create" />
          ) : (
            <ExplorerWorkbench onDirtyChange={dirty} />
          )}
        </StudioProvider>
      );
      if (kind === 'explorer') {
        await waitFor(() => expect(list).toHaveBeenCalled());
        expect(await screen.findByRole('button', { name: 'New Exploration' })).toBeTruthy();
        expect(dirty).toHaveBeenCalledWith(false);
      } else {
        await waitFor(() => expect(view.container.querySelector('button')).not.toBeNull());
        expect(list).not.toHaveBeenCalled();
      }
    }
  );

  it('retains the Explorer instance when an unrelated adapter changes', async () => {
    const { services, list } = fixture();
    const renderHost = (value: StudioServices) => (
      <StudioProvider scopeKey="session" schemaPath="/one" services={value} locale="en_US">
        <ExplorerWorkbench />
      </StudioProvider>
    );
    const view = render(renderHost(services));
    await waitFor(() => expect(list).toHaveBeenCalledOnce());
    view.rerender(renderHost({ ...services, console: { execute: vi.fn(), query: vi.fn() } }));
    await act(async () => {});
    expect(list).toHaveBeenCalledOnce();
  });

  it.each([true, false])('does not repeat unchanged dirty notifications with stableListener=%s', async (stable) => {
    const { services } = fixture();
    const changed = vi.fn();
    function Host() {
      const [state, setState] = useState({ dirty: false, updates: 0 });
      const listener = useCallback((dirty: boolean) => {
        changed(dirty);
        // Bound the regression so an update loop produces an assertion failure.
        if (changed.mock.calls.length < 4) setState((previous) => ({ ...previous, dirty }));
      }, []);
      return (
        <StudioProvider scopeKey="session" schemaPath="/one" services={services} locale="en_US">
          <button onClick={() => setState((previous) => ({ ...previous, updates: previous.updates + 1 }))}>
            Update {state.updates}
          </button>
          <ExplorerWorkbench onDirtyChange={stable ? listener : (dirty) => listener(dirty)} />
        </StudioProvider>
      );
    }
    render(<Host />);
    await waitFor(() => expect(changed).toHaveBeenCalledWith(false));
    expect(changed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Update 0' }));
    expect(changed).toHaveBeenCalledOnce();
  });

  it('rebinds the Schema editor after a schema change cancels its previous services', async () => {
    const { services } = fixture();
    const editorExecute = vi.fn<QueryExecutor>().mockResolvedValue({ code: 0, message: '', data: { tables: [] } });
    services.schemaEditor = { execute: editorExecute as QueryExecutor };
    const host = (schemaPath: string) => (
      <StudioProvider scopeKey="session" schemaPath={schemaPath} services={services} locale="en_US">
        <SchemaWorkbench sidebar={null} view={{ type: 'editor', mode: 'readonly', graphTypeName: 'People' }} />
      </StudioProvider>
    );
    const view = render(host('/one'));
    await waitFor(() => expect(editorExecute).toHaveBeenCalled());
    const count = editorExecute.mock.calls.length;
    view.rerender(host('/two'));
    await waitFor(() => expect(editorExecute.mock.calls.length).toBeGreaterThan(count));
    expect(editorExecute.mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(false);
  });

  it('reports plain tree selection data with UiProvider alone', async () => {
    const selected = vi.fn();
    render(
      <UiProvider locale="en_US">
        <SchemaTree
          schema={{
            name: 'one',
            owner: '',
            path: '/one',
            graphs: [{ graph: 'People', graph_type: 'Person', owner: '', schema: '/one', index_cnt: 0 }],
            graphTypes: [],
          }}
          onItemSelected={selected}
          onLoadNode={vi.fn().mockResolvedValue(undefined)}
          selector={{
            schemas: [{ path: '/one', name: 'one', owner: '' }],
            collapsed: false,
            onSwitchSchema: vi.fn(),
            onCreateSchema: vi.fn(),
            onViewAllSchemas: vi.fn(),
          }}
        />
      </UiProvider>
    );
    fireEvent.click(await screen.findByText('People'));
    expect(selected).toHaveBeenCalledWith({
      key: expect.any(String),
      rawData: expect.objectContaining({ type: SchemaItemType.GraphDescItem }),
    });
    expect(Object.keys(selected.mock.calls[0][0]).sort()).toEqual(['key', 'rawData']);
  });

  it('keeps standalone editors controlled and exposes only focus', async () => {
    const ref = createRef<GqlEditorHandle>();
    const changed = vi.fn();
    const view = render(
      <UiProvider>
        <GqlEditor value="RETURN 1" onChange={changed} ref={ref} />
      </UiProvider>
    );
    const input = await screen.findByRole('textbox', { name: 'Query' });
    expect(Object.keys(ref.current!)).toEqual(['focus']);
    ref.current?.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'RETURN 2' } });
    expect(changed).toHaveBeenCalledWith('RETURN 2');
    view.rerender(
      <UiProvider>
        <GqlEditor value="RETURN 3" ref={ref} />
      </UiProvider>
    );
    expect(input).toHaveProperty('value', 'RETURN 3');
    view.rerender(
      <UiProvider>
        <GqlViewer value="RETURN 4" ref={ref} />
      </UiProvider>
    );
    expect(screen.getByRole('textbox', { name: 'Query' })).toHaveProperty('readOnly', true);
  });
});
