import { createRef, useEffect, useRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioProvider, UiProvider } from './provider';
import { SchemaList, GraphTypeList, GraphList, GraphInfo, SchemaTree, SchemaItemType } from './schema';
import { SchemaEditorWorkbench, SketchList } from './schema-editor';
import { SnapshotList } from './explorer';
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
  it.each(['schemas', 'graph-types', 'graphs', 'graph', 'sketches', 'schema-editor', 'explorer'])(
    'mounts %s without a router or optional persistence services',
    async (kind) => {
      const { services, list } = fixture();
      const view = render(
        <StudioProvider scopeKey="session" schemaPath="/one" services={services} locale="en_US">
          {kind === 'schemas' ? (
            <SchemaList />
          ) : kind === 'graph-types' ? (
            <GraphTypeList onCreate={vi.fn()} />
          ) : kind === 'graphs' ? (
            <GraphList onCreate={vi.fn()} />
          ) : kind === 'graph' ? (
            <GraphInfo graphName="People" />
          ) : kind === 'sketches' ? (
            <SketchList />
          ) : kind === 'schema-editor' ? (
            <SchemaEditorWorkbench mode="create" />
          ) : (
            <SnapshotList />
          )}
        </StudioProvider>
      );
      if (kind === 'explorer') {
        await waitFor(() => expect(list).toHaveBeenCalled());
        expect(await screen.findByRole('button', { name: 'New Exploration' })).toBeTruthy();
      } else if (kind === 'graph-types') {
        expect(await screen.findByRole('button', { name: 'Create' })).toBeTruthy();
        expect(list).not.toHaveBeenCalled();
      } else {
        await waitFor(() => expect(view.container.querySelector('.MuiContainer-root')).not.toBeNull());
        expect(list).not.toHaveBeenCalled();
      }
    }
  );

  it('keeps a standalone list usable when initial schema metadata fails', async () => {
    const { services, execute } = fixture();
    execute.mockRejectedValueOnce(new Error('metadata unavailable'));
    render(
      <StudioProvider scopeKey="session" services={services} locale="en_US">
        <GraphTypeList onCreate={vi.fn()} />
      </StudioProvider>
    );
    expect(await screen.findByRole('button', { name: 'Create' })).toBeTruthy();
  });

  it('retains the Explorer instance when an unrelated adapter changes', async () => {
    const { services, list } = fixture();
    const renderHost = (value: StudioServices) => (
      <StudioProvider scopeKey="session" schemaPath="/one" services={value} locale="en_US">
        <SnapshotList />
      </StudioProvider>
    );
    const view = render(renderHost(services));
    await waitFor(() => expect(list).toHaveBeenCalledOnce());
    view.rerender(renderHost({ ...services, console: { execute: vi.fn(), query: vi.fn() } }));
    await act(async () => {});
    expect(list).toHaveBeenCalledOnce();
  });

  it('rebinds the Schema editor after a schema change cancels its previous services', async () => {
    const { services } = fixture();
    const editorExecute = vi.fn<QueryExecutor>().mockResolvedValue({ code: 0, message: '', data: { tables: [] } });
    services.schemaEditor = { execute: editorExecute as QueryExecutor };
    const host = (schemaPath: string) => (
      <StudioProvider scopeKey="session" schemaPath={schemaPath} services={services} locale="en_US">
        <SchemaEditorWorkbench mode="readonly" graphTypeName="People" />
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
