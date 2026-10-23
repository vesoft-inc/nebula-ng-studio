// @vitest-environment jsdom
import type { ComponentType, PropsWithChildren } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form-mui';
import { GraphEntityType, PropertyDataType, type ServerResponse } from '@vesoft-inc/utils';
import { UiProvider } from '../../provider';
import type { QueryExecutor } from '../../shared/query';
import FormVectorIndex from './FormVectorIndex';
import FormNormalIndex, { type GraphTypeElementOption } from './FormNormalIndex';
import FormSpatialIndex from './FormSpatialIndex';
import FormFulltextIndex from './FormFulltextIndex';
import FormVertexCentricIndex from './FormVertexCentricIndex';
import { IndexQueryProvider } from './queryContext';
import { useTypesForNodesAndEdges } from './useTypesForNodesAndEdges';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function entity(type_name: string, entity_type = GraphEntityType.Node): GraphTypeElementOption {
  return {
    type_name,
    entity_type,
    graph_name: 'demo',
    graph_type_name: 'Schema',
    labels: [],
    properties: ['shared'],
    'primary_key/multiedge_key': 'Unique',
    type_pattern: `(Person)-[${type_name}]->(Person)`,
  };
}
function property(type_name: string, data_type: string) {
  return { type_name, property_name: 'shared', data_type: data_type as PropertyDataType };
}
function response(tables: ReturnType<typeof property>[]): ServerResponse<object> {
  return { code: 0, message: '', data: { tables } };
}
type IndexForm<T extends FieldValues> = ComponentType<{ form: UseFormReturn<T>; entities: GraphTypeElementOption[] }>;
function renderForm<T extends FieldValues>(
  Component: IndexForm<T>,
  entities: GraphTypeElementOption[],
  execute: ReturnType<typeof vi.fn<QueryExecutor>>
) {
  let form!: UseFormReturn<T>;
  function Harness() {
    form = useForm<T>();
    return (
      <UiProvider locale="en_US">
        <IndexQueryProvider value={execute as QueryExecutor}>
          <Component form={form} entities={entities} />
        </IndexQueryProvider>
      </UiProvider>
    );
  }
  const view = render(<Harness />);
  return { ...view, form, rerender: () => view.rerender(<Harness />) };
}

describe('index property metadata', () => {
  it('scopes same-named properties to both the type name and node/edge kind', async () => {
    const execute = vi
      .fn<QueryExecutor>()
      .mockResolvedValueOnce(response([property('Short', 'VECTOR<3, FLOAT>'), property('Long', 'VECTOR<128, FLOAT>')]))
      .mockResolvedValueOnce(response([property('Long', 'VECTOR<256, FLOAT>')]));
    const wrapper = ({ children }: PropsWithChildren) => (
      <IndexQueryProvider value={execute as QueryExecutor}>{children}</IndexQueryProvider>
    );
    const { result, rerender } = renderHook(useTypesForNodesAndEdges, {
      wrapper,
      initialProps: { graphTypeName: 'Schema', typeName: 'Long', entityType: GraphEntityType.Node },
    });
    await waitFor(() => expect(result.current.items.map((item) => item.data_type)).toEqual(['VECTOR<128, FLOAT>']));
    rerender({ graphTypeName: 'Schema', typeName: 'Long', entityType: GraphEntityType.Edge });
    expect(result.current.items.map((item) => item.data_type)).toEqual(['VECTOR<256, FLOAT>']);
    rerender({ graphTypeName: 'Schema', typeName: 'Short', entityType: GraphEntityType.Node });
    expect(result.current.items.map((item) => item.data_type)).toEqual(['VECTOR<3, FLOAT>']);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('ignores metadata from an older graph type that resolves after switching graphs', async () => {
    let finishOld!: (value: ServerResponse<object>) => void;
    const pending = new Promise<ServerResponse<object>>((resolve) => {
      finishOld = resolve;
    });
    const execute = vi
      .fn<QueryExecutor>()
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([property('Shared', 'VECTOR<128, FLOAT>')]))
      .mockResolvedValueOnce(response([]));
    const wrapper = ({ children }: PropsWithChildren) => (
      <IndexQueryProvider value={execute as QueryExecutor}>{children}</IndexQueryProvider>
    );
    const { result, rerender } = renderHook(useTypesForNodesAndEdges, {
      wrapper,
      initialProps: { graphTypeName: 'Old', typeName: 'Shared', entityType: GraphEntityType.Node },
    });
    rerender({ graphTypeName: 'New', typeName: 'Shared', entityType: GraphEntityType.Node });
    expect(result.current.items).toEqual([]);
    await waitFor(() => expect(result.current.items.map((item) => item.data_type)).toEqual(['VECTOR<128, FLOAT>']));
    await act(async () => finishOld(response([property('Shared', 'VECTOR<3, FLOAT>')])));
    expect(result.current.items.map((item) => item.data_type)).toEqual(['VECTOR<128, FLOAT>']);
  });
});

describe('vector index dimension', () => {
  it('settles after one dimension update and follows entity, property and kind changes', async () => {
    const entities = [entity('Short'), entity('Long'), entity('Long', GraphEntityType.Edge)];
    const execute = vi
      .fn<QueryExecutor>()
      .mockResolvedValueOnce(response([property('Short', 'VECTOR<3, FLOAT>'), property('Long', 'VECTOR<128, FLOAT>')]))
      .mockResolvedValueOnce(response([property('Long', 'VECTOR<256, FLOAT>')]));
    const { form, rerender } = renderForm(FormVectorIndex, entities, execute);
    await act(async () =>
      form.setValue('on', {
        ...entities[1],
        propName: '',
        metrics: {
          DIM: undefined,
          METRIC: '',
          TYPE: '',
          NLIST: undefined,
          TRAINSIZE: undefined,
          MAX_DEGREE: undefined,
          EFCONSTRUCTION: undefined,
          CAPACITY: undefined,
        },
      })
    );
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    const originalSetValue = form.setValue;
    let dimensionWrites = 0;
    vi.spyOn(form, 'setValue').mockImplementation((name, value, options) => {
      // Fail quickly if an effect regression starts writing DIM on every render.
      if (name === 'on.metrics.DIM' && ++dimensionWrites > 10) throw new Error('DIM update loop');
      originalSetValue(name, value, options);
    });
    await act(async () => form.setValue('on.propName', 'shared'));
    expect(form.getValues('on.metrics.DIM')).toBe(128);
    expect(dimensionWrites).toBe(1);
    await act(async () => form.setValue('indexName', 'vector_index'));
    rerender();
    expect(dimensionWrites).toBe(1);
    await act(async () => form.setValue('on.propName', ''));
    expect(form.getValues('on.metrics.DIM')).toBeUndefined();
    await act(async () => form.setValue('on.propName', 'shared'));
    await act(async () => form.setValue('on.entity_type', GraphEntityType.Edge));
    expect(form.getValues('on.propName')).toBe('');
    expect(form.getValues('on.metrics.DIM')).toBeUndefined();
    await act(async () => form.setValue('on.propName', 'shared'));
    expect(form.getValues('on.metrics.DIM')).toBe(256);
    await act(async () => {
      form.setValue('on.entity_type', GraphEntityType.Node);
      form.setValue('on.type_name', 'Short');
    });
    await act(async () => form.setValue('on.propName', 'shared'));
    expect(form.getValues('on.metrics.DIM')).toBe(3);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

async function verifyPropertyOptions<T extends FieldValues>(
  Component: IndexForm<T>,
  validType: string,
  invalidType: string,
  multiple = false,
  kind = GraphEntityType.Node
) {
  const entities = [entity('Allowed', kind), entity('Blocked', kind)];
  const details = [property('Allowed', validType), property('Blocked', invalidType)];
  const execute = vi
    .fn<QueryExecutor>()
    .mockResolvedValueOnce(response(kind === GraphEntityType.Node ? details : []))
    .mockResolvedValueOnce(response(kind === GraphEntityType.Edge ? details : []));
  renderForm(Component, entities, execute);
  for (const [typeName, disabled] of [
    ['Blocked', 'true'],
    ['Allowed', null],
  ] as const) {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /^ON/ }));
    fireEvent.click(await screen.findByRole('option', { name: typeName }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    if (multiple) fireEvent.click(screen.getByRole('button', { name: 'Add Property' }));
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    expect((await screen.findByRole('option', { name: 'shared' })).getAttribute('aria-disabled')).toBe(disabled);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  }
}

describe('index form property eligibility', () => {
  it('scopes vector properties', () => verifyPropertyOptions(FormVectorIndex, 'VECTOR<3, FLOAT>', 'STRING'));
  it('scopes normal properties', () => verifyPropertyOptions(FormNormalIndex, 'STRING', 'VECTOR<3, FLOAT>', true));
  it('scopes spatial properties', () => verifyPropertyOptions(FormSpatialIndex, 'GEOGRAPHY(POINT)', 'STRING'));
  it('scopes fulltext properties', () => verifyPropertyOptions(FormFulltextIndex, 'STRING', 'INT32'));
  it('scopes vertex-centric edge properties', () =>
    verifyPropertyOptions(FormVertexCentricIndex, 'STRING', 'VECTOR<3, FLOAT>', true, GraphEntityType.Edge));
});
