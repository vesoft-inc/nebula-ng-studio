import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphEntityType, type ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { StudioProvider } from './provider';
import { GraphList, SchemaList, SchemaTreePanel, type SchemaTreePanelProps, type SchemaTreeSelection } from './schema';
import type { QueryExecutor, QueryOptions, SchemaServices, StudioServices } from './services';

vi.mock('@antv/layout-gpu', () => ({ FruchtermanLayout: class {} }));
vi.mock('../../studio-ui-internal/src/editor/MonacoEditor', () => ({ default: () => null }));

afterEach(async () => {
  cleanup();
  await act(async () => {});
});

type Response = ServerResponse<object>;
const response = (tables: object[] = []): Response => ({ code: 0, message: '', data: { tables } });
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(prefix = 'book') {
  const graphTypeName = `${prefix}-type`;
  const entityTypeName = `${prefix}-node`;
  const graphType = { schema: '/one', graph_type: graphTypeName, owner: '', entities: [] };
  const entity = {
    graph_type_name: graphTypeName,
    type_name: entityTypeName,
    entity_type: GraphEntityType.Node,
    labels: [],
    properties: [],
    'primary_key/multiedge_key': ['id'],
  };
  const schemas = [
    { path: '/one', name: 'one', owner: '' },
    { path: '/two', name: 'two', owner: '' },
  ];
  const graphs = [{ graph: `${prefix}-graph`, graph_type: graphTypeName, schema: '/one', owner: '', index_cnt: 0 }];
  const overrides = new Map<string, (options?: QueryOptions) => Promise<Response>>();
  const execute = vi.fn(async (gql: string, options?: QueryOptions): Promise<Response> => {
    const override = overrides.get(gql);
    if (override) return override(options);
    if (gql === 'SHOW CURRENT_SCHEMA') return response([schemas[0]]);
    if (gql === 'SHOW SCHEMAS') return response([...schemas]);
    if (gql === 'SHOW GRAPH TYPES') return response([graphType]);
    if (gql.startsWith('call show_graphs()')) return response([...graphs]);
    if (gql.startsWith('DESCRIBE GRAPH TYPE')) return response([entity]);
    if (gql.startsWith('DESCRIBE NODE TYPE'))
      return response([{ property_name: 'first-name', data_type: 'STRING', nullable: 'Y', primary_key: 'N' }]);
    if (gql.startsWith('CREATE GRAPH')) {
      graphs.push({ ...graphs[0], graph: 'created-graph' });
      return response();
    }
    if (gql.startsWith('CREATE SCHEMA')) return response();
    return response();
  });
  const switchSchema = vi.fn().mockResolvedValue(response());
  const schema: SchemaServices = { execute: execute as QueryExecutor, switchSchema };
  const services: StudioServices = { schema };
  return { execute, overrides, switchSchema, services, graphTypeName, entityTypeName, graphType, graphs };
}

function host(
  services: StudioServices,
  props: SchemaTreePanelProps = {},
  options: {
    schemaPath?: string;
    scopeKey?: string;
    onSchemaChange?: (path: string) => void;
    children?: ReactNode;
  } = {}
) {
  return (
    <StudioProvider
      scopeKey={options.scopeKey ?? 'session'}
      schemaPath={options.schemaPath}
      onSchemaChange={options.onSchemaChange}
      services={services}
      locale="en_US"
    >
      <SchemaTreePanel {...props} />
      {options.children}
    </StudioProvider>
  );
}

function tree(container: HTMLElement) {
  return container.querySelector('nav') as HTMLElement;
}
function expand(container: HTMLElement, text: string) {
  const row = within(tree(container)).getByText(text).closest('li')!;
  fireEvent.click(row.querySelector('svg')!.parentElement!);
}
async function ready() {
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
}
async function openSelector() {
  fireEvent.click(await screen.findByRole('button', { name: 'one' }));
}
async function openGraphDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Create Graph' }));
  return screen.findByRole('dialog', { hidden: true });
}
async function submitGraph(dialog: HTMLElement, graphTypeName: string) {
  fireEvent.mouseDown(within(dialog).getByRole('combobox', { hidden: true }));
  fireEvent.click(await screen.findByRole('option', { name: graphTypeName, hidden: true }));
  fireEvent.change(dialog.querySelector('input[name="graphName"]')!, { target: { value: 'created-graph' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm', hidden: true }));
}

describe('SchemaTreePanel', () => {
  it('discovers the schema and merges pending initialization with sibling views in StrictMode', async () => {
    const { services, execute, overrides } = fixture();
    const schemas = deferred();
    overrides.set('SHOW SCHEMAS', () => schemas.promise);
    render(<StrictMode>{host(services, {}, { children: <SchemaList /> })}</StrictMode>);
    await screen.findByRole('button', { name: 'one' });
    await screen.findByText('Catalog');
    await act(async () => schemas.resolve(response([{ path: '/one', name: 'one', owner: '' }])));
    await ready();
    expect(execute.mock.calls.filter(([gql]) => gql === 'SHOW CURRENT_SCHEMA')).toHaveLength(1);
    expect(execute.mock.calls.filter(([gql]) => gql === 'SHOW SCHEMAS')).toHaveLength(1);
    expect(execute.mock.calls.some(([gql]) => gql === 'SHOW GRAPH TYPES')).toBe(false);
  });

  it('loads directories, entities and properties on expansion and emits plain semantic selections', async () => {
    const { services, execute, graphTypeName, entityTypeName } = fixture();
    const onSelect = vi.fn();
    const view = render(host(services, { showDetail: true, onSelect }, { schemaPath: '/one' }));
    await ready();
    expect(execute.mock.calls.map(([gql]) => gql)).toEqual(['SHOW SCHEMAS']);
    expand(view.container, 'Graph Type');
    await screen.findByText(graphTypeName);
    expect(execute.mock.calls.some(([gql]) => gql.startsWith('DESCRIBE'))).toBe(false);
    expand(view.container, graphTypeName);
    await screen.findByText(entityTypeName);
    expand(view.container, entityTypeName);
    fireEvent.click(await screen.findByText('first-name'));
    expect(onSelect).toHaveBeenLastCalledWith({
      schemaPath: '/one',
      kind: 'property',
      graphTypeName,
      entityTypeName,
      propertyName: 'first-name',
    });
    expect(execute.mock.calls.map(([gql]) => gql)).toContain(
      `DESCRIBE NODE TYPE \`${entityTypeName}\` OF \`${graphTypeName}\` `
    );
  });

  it.each([false, true])('supports semantic selection (controlled: %s)', async (controlled) => {
    const { services } = fixture();
    const onSelect = vi.fn();
    const initial: SchemaTreeSelection = { schemaPath: '/one', kind: 'graph-types' };
    const props = { onSelect, ...(controlled ? { selected: initial } : {}) };
    const view = render(host(services, props, { schemaPath: '/one' }));
    await ready();
    fireEvent.click(within(tree(view.container)).getByText('Graph'));
    expect(onSelect).toHaveBeenCalledWith({ schemaPath: '/one', kind: 'graphs' });
    expect(tree(view.container).querySelector('[aria-current]')?.textContent).toBe(controlled ? 'Graph Type' : 'Graph');
  });

  it('clears controlled highlighting for null or another schema without emitting selection events', async () => {
    const { services } = fixture();
    const onSelect = vi.fn();
    const view = render(
      host(services, { selected: { schemaPath: '/one', kind: 'graphs' }, onSelect }, { schemaPath: '/one' })
    );
    await ready();
    expect(tree(view.container).querySelector('[aria-current]')?.textContent).toBe('Graph');
    for (const selected of [null, { schemaPath: '/two', kind: 'graphs' } as const]) {
      view.rerender(host(services, { selected, onSelect }, { schemaPath: '/one' }));
      expect(tree(view.container).querySelector('[aria-current]')).toBeNull();
    }
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('creates a graph in the built-in dialog and refreshes the shared tree and graph list', async () => {
    const { services, graphTypeName } = fixture();
    render(host(services, {}, { schemaPath: '/one', children: <GraphList /> }));
    await waitFor(() => expect(screen.getAllByText('book-graph')).toHaveLength(2));
    await submitGraph(await openGraphDialog(), graphTypeName);
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
    await waitFor(() => expect(screen.getAllByText('created-graph')).toHaveLength(2));
  });

  it('refreshes after creation while an older tree read is still pending without showing a cancellation error', async () => {
    const { services, execute, graphTypeName, graphs } = fixture();
    const oldGraphs = [...graphs];
    const pending = deferred();
    const respond = execute.getMockImplementation()!;
    let graphReads = 0;
    execute.mockImplementation(async (gql, options) => {
      if (gql.startsWith('call show_graphs()') && graphReads++ === 0) return pending.promise;
      return respond(gql, options);
    });
    const view = render(host(services, {}, { schemaPath: '/one' }));
    await ready();
    expand(view.container, 'Graph');
    await waitFor(() => expect(graphReads).toBe(1));
    await submitGraph(await openGraphDialog(), graphTypeName);
    expect(await screen.findByText('created-graph')).toBeTruthy();
    await act(async () => pending.resolve(response(oldGraphs)));
    await ready();
    expect(screen.getByText('created-graph')).toBeTruthy();
    expect(screen.queryByText('Unable to load Schema data.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('can cancel graph creation without submitting a query', async () => {
    const { services, execute } = fixture();
    render(host(services, {}, { schemaPath: '/one' }));
    const dialog = await openGraphDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel', hidden: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
    expect(execute.mock.calls.some(([gql]) => gql.startsWith('CREATE GRAPH'))).toBe(false);
  });

  it('can retry loading GraphType choices before opening graph creation', async () => {
    const { services, overrides, graphTypeName } = fixture();
    overrides.set('SHOW GRAPH TYPES', async () => ({ code: 1, message: 'choices unavailable' }));
    render(host(services, {}, { schemaPath: '/one' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create Graph' }));
    expect(await screen.findByText('choices unavailable')).toBeTruthy();
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    await ready();
    overrides.clear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    const dialog = await screen.findByRole('dialog', { hidden: true });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { hidden: true }));
    expect(await screen.findByRole('option', { name: graphTypeName, hidden: true })).toBeTruthy();
  });

  it('closes graph creation on a schema change and ignores its late success', async () => {
    const { services, overrides, graphTypeName } = fixture();
    const pending = deferred();
    const create = vi.fn(() => pending.promise);
    overrides.set(`CREATE GRAPH \`created-graph\` :: \`${graphTypeName}\``, create);
    const view = render(host(services, {}, { schemaPath: '/one' }));
    await submitGraph(await openGraphDialog(), graphTypeName);
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    view.rerender(host(services, {}, { schemaPath: '/two' }));
    await act(async () => pending.resolve(response()));
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'two' })).toBeTruthy();
    expect(screen.queryByText('Create Graph Success')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('retains shared metadata while the tree page is absent', async () => {
    const { services, execute } = fixture();
    const page = (show: boolean) => (
      <StudioProvider scopeKey="session" schemaPath="/one" services={services} locale="en_US">
        {show ? <SchemaTreePanel /> : <section>Other page</section>}
      </StudioProvider>
    );
    const view = render(page(true));
    await ready();
    expand(view.container, 'Graph Type');
    expect(await screen.findByText('book-type')).toBeTruthy();
    view.rerender(page(false));
    view.rerender(page(true));
    expect(await screen.findByText('book-type')).toBeTruthy();
    expect(execute.mock.calls.filter(([gql]) => gql === 'SHOW GRAPH TYPES')).toHaveLength(1);
  });

  it.each(['business', 'transport'])('keeps graph creation available after a %s failure', async (failure) => {
    const { services, overrides, graphTypeName } = fixture();
    overrides.set(`CREATE GRAPH \`created-graph\` :: \`${graphTypeName}\``, async () => {
      if (failure === 'transport') throw new Error('creation unavailable');
      return { code: 1, message: 'creation unavailable' };
    });
    render(host(services, {}, { schemaPath: '/one' }));
    const dialog = await openGraphDialog();
    await submitGraph(dialog, graphTypeName);
    expect(await screen.findByText('creation unavailable')).toBeTruthy();
    expect(screen.getByRole('dialog', { hidden: true })).toBe(dialog);
    overrides.clear();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm', hidden: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
  });

  it('switches schemas through the provider and clears tree selection and expansion', async () => {
    const { services } = fixture();
    const onSchemaChange = vi.fn();
    const view = render(host(services, {}, { schemaPath: '/one', onSchemaChange }));
    await ready();
    expand(view.container, 'Graph');
    fireEvent.click(await screen.findByText('book-graph'));
    await openSelector();
    fireEvent.click(await screen.findByRole('button', { name: '/two' }));
    await waitFor(() => expect(onSchemaChange).toHaveBeenCalledWith('/two'));
    expect(screen.getByRole('button', { name: 'two' })).toBeTruthy();
    expect(tree(view.container).querySelector('[aria-current]')).toBeNull();
    expect(within(tree(view.container)).queryByText('book-graph')).toBeNull();
  });

  it.each(['business', 'transport'])('keeps the previous schema after a %s switch failure', async (failure) => {
    const { services, switchSchema } = fixture();
    if (failure === 'transport') switchSchema.mockRejectedValueOnce(new Error('switch unavailable'));
    else switchSchema.mockResolvedValueOnce({ code: 1, message: 'switch unavailable' });
    const onSchemaChange = vi.fn();
    render(host(services, {}, { schemaPath: '/one', onSchemaChange }));
    await openSelector();
    fireEvent.click(await screen.findByRole('button', { name: '/two' }));
    expect(await screen.findByText('switch unavailable')).toBeTruthy();
    expect(onSchemaChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'one', hidden: true })).toBeTruthy();
  });

  it('completes provider synchronization when the tree unmounts during a schema switch', async () => {
    const { services, switchSchema } = fixture();
    const pending = deferred();
    switchSchema.mockReturnValueOnce(pending.promise);
    const onSchemaChange = vi.fn();
    const page = (show: boolean) => (
      <StudioProvider
        scopeKey="session"
        schemaPath="/one"
        services={services}
        onSchemaChange={onSchemaChange}
        locale="en_US"
      >
        {show ? <SchemaTreePanel /> : <section>Other page</section>}
      </StudioProvider>
    );
    const view = render(page(true));
    await openSelector();
    fireEvent.click(await screen.findByRole('button', { name: '/two' }));
    await waitFor(() => expect(switchSchema).toHaveBeenCalledOnce());
    view.rerender(page(false));
    await act(async () => pending.resolve(response()));
    expect(onSchemaChange).toHaveBeenCalledOnce();
    expect(onSchemaChange).toHaveBeenCalledWith('/two');
    view.rerender(page(true));
    expect(await screen.findByRole('button', { name: 'two' })).toBeTruthy();
  });

  it.each(['scope', 'service'])('does not synchronize a switch after its %s is replaced', async (kind) => {
    const first = fixture();
    const next = fixture();
    const pending = deferred();
    first.switchSchema.mockReturnValueOnce(pending.promise);
    const onSchemaChange = vi.fn();
    const view = render(host(first.services, {}, { schemaPath: '/one', onSchemaChange }));
    await openSelector();
    fireEvent.click(await screen.findByRole('button', { name: '/two' }));
    await waitFor(() => expect(first.switchSchema).toHaveBeenCalledOnce());
    view.rerender(
      host(
        next.services,
        {},
        {
          schemaPath: '/one',
          scopeKey: kind === 'scope' ? 'next' : 'session',
          onSchemaChange,
        }
      )
    );
    await act(async () => pending.resolve(response()));
    expect(onSchemaChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'one' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['entity-type', 'property'] as const)(
    'keeps %s selection unique for ambiguous hyphenated names',
    async (kind) => {
      const { services, overrides } = fixture();
      overrides.set('SHOW GRAPH TYPES', async () =>
        response([
          { graph_type: 'a-b', schema: '/one', owner: '' },
          { graph_type: 'a', schema: '/one', owner: '' },
        ])
      );
      for (const [graphTypeName, entityTypeName] of [
        ['a-b', 'c'],
        ['a', 'b-c'],
      ]) {
        overrides.set(`DESCRIBE GRAPH TYPE \`${graphTypeName}\``, async () =>
          response([
            {
              graph_type_name: graphTypeName,
              type_name: entityTypeName,
              entity_type: GraphEntityType.Node,
              labels: [],
              properties: [],
            },
          ])
        );
      }
      const onSelect = vi.fn();
      const selected: SchemaTreeSelection =
        kind === 'entity-type'
          ? { schemaPath: '/one', kind, graphTypeName: 'a-b', entityTypeName: 'c' }
          : { schemaPath: '/one', kind, graphTypeName: 'a-b', entityTypeName: 'c', propertyName: 'first-name' };
      const view = render(host(services, { showDetail: true, selected, onSelect }, { schemaPath: '/one' }));
      await ready();
      expand(view.container, 'Graph Type');
      await screen.findByText('a-b');
      expand(view.container, 'a-b');
      await screen.findByText('c');
      expand(view.container, 'a');
      await screen.findByText('b-c');
      if (kind === 'property') {
        expand(view.container, 'c');
        await screen.findByText('first-name');
        expand(view.container, 'b-c');
        await waitFor(() => expect(screen.getAllByText('first-name')).toHaveLength(2));
      }
      const selectedRows = tree(view.container).querySelectorAll('[aria-current]');
      expect(selectedRows).toHaveLength(1);
      expect(selectedRows[0].textContent).toContain(kind === 'entity-type' ? 'c' : 'first-name');
      if (kind === 'entity-type') fireEvent.click(screen.getByText('b-c'));
      else fireEvent.click(screen.getAllByText('first-name')[1]);
      expect(onSelect).toHaveBeenCalledWith({
        schemaPath: '/one',
        kind,
        graphTypeName: 'a',
        entityTypeName: 'b-c',
        ...(kind === 'property' ? { propertyName: 'first-name' } : {}),
      });
      expect(tree(view.container).querySelectorAll('[aria-current]')).toHaveLength(1);
    }
  );

  it('does not apply a late switch after the host selects a different schema', async () => {
    const { services, switchSchema } = fixture();
    const pending = deferred();
    switchSchema.mockReturnValueOnce(pending.promise);
    const onSchemaChange = vi.fn();
    const view = render(host(services, {}, { schemaPath: '/one', onSchemaChange }));
    await openSelector();
    fireEvent.click(await screen.findByRole('button', { name: '/two' }));
    await waitFor(() => expect(switchSchema).toHaveBeenCalledOnce());
    view.rerender(host(services, {}, { schemaPath: '/external', onSchemaChange }));
    await act(async () => pending.resolve(response()));
    expect(screen.getByRole('button', { name: 'external' })).toBeTruthy();
    expect(onSchemaChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps a successful schema creation successful when refreshing the catalog fails', async () => {
    const { services, overrides, switchSchema } = fixture();
    const onSchemaCreated = vi.fn();
    render(host(services, { onSchemaCreated }, { schemaPath: '/one' }));
    await ready();
    await openSelector();
    fireEvent.click(await screen.findByRole('button', { name: 'Create Schema' }));
    const dialog = await screen.findByRole('dialog', { hidden: true });
    overrides.set('SHOW SCHEMAS', async () => {
      throw new Error('catalog unavailable');
    });
    fireEvent.change(within(dialog).getByRole('textbox', { hidden: true }), { target: { value: '/new' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create', hidden: true }));
    await waitFor(() => expect(onSchemaCreated).toHaveBeenCalledWith('/new'));
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
    expect(switchSchema).not.toHaveBeenCalled();
    expect(await screen.findByText('catalog unavailable')).toBeTruthy();
  });

  it('suppresses a schema-created callback after the tree unmounts during refresh', async () => {
    const { services, overrides } = fixture();
    const pending = deferred();
    const onSchemaCreated = vi.fn();
    const view = render(host(services, { onSchemaCreated }, { schemaPath: '/one' }));
    await ready();
    await openSelector();
    fireEvent.click(await screen.findByRole('button', { name: 'Create Schema' }));
    const dialog = await screen.findByRole('dialog', { hidden: true });
    const refresh = vi.fn(() => pending.promise);
    overrides.set('SHOW SCHEMAS', refresh);
    fireEvent.change(within(dialog).getByRole('textbox', { hidden: true }), { target: { value: '/new' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create', hidden: true }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    view.unmount();
    await act(async () => pending.resolve(response()));
    expect(onSchemaCreated).not.toHaveBeenCalled();
  });

  it.each(['initial', 'branch'])('allows local retry after a failed %s read', async (kind) => {
    const { services, overrides, graphTypeName } = fixture();
    const query = kind === 'initial' ? 'SHOW SCHEMAS' : 'SHOW GRAPH TYPES';
    overrides.set(query, async () => ({ code: 1, message: 'metadata unavailable' }));
    const view = render(host(services, {}, { schemaPath: '/one' }));
    if (kind === 'branch') {
      await ready();
      expand(view.container, 'Graph Type');
    }
    expect(await screen.findByText('metadata unavailable')).toBeTruthy();
    await ready();
    overrides.clear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('metadata unavailable')).toBeNull());
    await ready();
    if (kind === 'branch') expect(await screen.findByText(graphTypeName)).toBeTruthy();
  });

  it.each(['scope', 'service', 'schema'])('ignores late reads after a %s change', async (kind) => {
    const first = fixture('old');
    const next = fixture('new');
    const pending = deferred();
    const oldRead = vi.fn(() => pending.promise);
    first.overrides.set('SHOW GRAPH TYPES', oldRead);
    const view = render(host(first.services, {}, { schemaPath: '/one' }));
    await ready();
    expand(view.container, 'Graph Type');
    await waitFor(() => expect(oldRead).toHaveBeenCalled());
    if (kind === 'schema') first.overrides.clear();
    view.rerender(
      host(
        kind === 'schema' ? first.services : next.services,
        {},
        {
          schemaPath: kind === 'schema' ? '/two' : '/one',
          scopeKey: kind === 'scope' ? 'next' : 'session',
        }
      )
    );
    await act(async () => pending.resolve(response([first.graphType])));
    await ready();
    expect(screen.queryByText('old-type')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    expand(view.container, 'Graph Type');
    expect(await screen.findByText(kind === 'schema' ? 'old-type' : 'new-type')).toBeTruthy();
  });

  it('isolates providers and exposes navigation only as optional events', async () => {
    const first = fixture('first');
    const second = fixture('second');
    const onCreateGraphType = vi.fn();
    const onViewAllSchemas = vi.fn();
    const view = render(
      <>
        <section data-testid="first">
          {host(first.services, { onCreateGraphType, onViewAllSchemas }, { schemaPath: '/one' })}
        </section>
        <section data-testid="second">{host(second.services, {}, { schemaPath: '/one' })}</section>
      </>
    );
    await ready();
    fireEvent.click(within(screen.getByTestId('first')).getByRole('button', { name: 'Create Graph Type' }));
    expect(onCreateGraphType).toHaveBeenCalledOnce();
    expect(within(screen.getByTestId('second')).queryByRole('button', { name: 'Create Graph Type' })).toBeNull();
    expand(screen.getByTestId('first'), 'Graph Type');
    expect(await screen.findByText('first-type')).toBeTruthy();
    expect(second.execute.mock.calls.some(([gql]) => gql === 'SHOW GRAPH TYPES')).toBe(false);
    fireEvent.click(within(screen.getByTestId('first')).getByRole('button', { name: 'one' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View All Schemas' }));
    expect(onViewAllSchemas).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('omits unconfigured navigation actions while retaining built-in creation', async () => {
    const { services } = fixture();
    render(host(services, {}, { schemaPath: '/one' }));
    await ready();
    expect(screen.queryByRole('button', { name: 'Create Graph Type' })).toBeNull();
    await openSelector();
    expect(screen.queryByRole('button', { name: 'View All Schemas' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create Schema' })).toBeTruthy();
  });
});
