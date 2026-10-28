import { afterEach, describe, expect, it, vi } from 'vitest';
import { INodeTypeItem, IEdgeTypeItem, IProperty } from '../schema/types';
import { VisualEditorType } from '../shared/constants';
import SchemaEditorState from './SchemaEditorState';

const states: SchemaEditorState[] = [];
const state = () => {
  const execute = vi.fn();
  const read = vi.fn(async () => null);
  const store = new SchemaEditorState({ execute, layouts: { read, write: async () => true } });
  states.push(store);
  return { store, execute, read };
};
afterEach(() => {
  states.splice(0).forEach((store) => store.disposeReaction());
});

describe('schema editor instances and asynchronous loads', () => {
  it('selects and cancels a node draft without committing, then applies an explicit commit', () => {
    const { store } = state();
    const node = new INodeTypeItem({ name: 'Person', properties: [new IProperty({ name: 'name' })] });
    store.updateNodeTypeList([node]);
    const draft = new INodeTypeItem({ id: node.id, name: 'Renamed', properties: node.properties });
    store.selectItem({ type: VisualEditorType.Tag, value: draft });
    expect(node.name).toBe('Person');
    store.selectItem();
    expect(node.name).toBe('Person');

    const propertyId = node.properties[0].id;
    store.commitNodeChanges(node.id, draft);
    expect(node.name).toBe('Renamed');
    expect(node.properties[0].id).toBe(propertyId);
  });

  it('keeps edge selection separate from persistence and retains the existing edge identity on commit', () => {
    const { store } = state();
    const node = new INodeTypeItem({ name: 'Person' });
    const edge = new IEdgeTypeItem({ name: 'Knows', srcNode: node, dstNode: node });
    store.updateEdgeTypeList([edge]);
    const draft = new IEdgeTypeItem({ id: edge.id, name: 'Follows', srcNode: node, dstNode: node });
    store.selectItem({ type: VisualEditorType.Edge, value: draft });
    store.selectItem();
    expect(edge.name).toBe('Knows');
    const id = edge.id;
    store.commitEdgeChanges(id, draft);
    expect(edge.name).toBe('Follows');
    expect(edge.id).toBe(id);
    expect(edge.srcNode).toBe(node);
  });

  it('keeps the legacy setter commit behavior without a background reaction', () => {
    const { store } = state();
    const node = new INodeTypeItem({ name: 'Person' });
    store.updateNodeTypeList([node]);
    const draft = new INodeTypeItem({ id: node.id, name: 'Renamed' });
    store.activeItem = { type: VisualEditorType.Tag, value: draft };
    expect(node.name).toBe('Person');
    store.selectItem();
    store.setActiveItem({ type: VisualEditorType.Tag, value: draft });
    expect(node.name).toBe('Renamed');
  });

  it('ignores a late response after disposal and aborts query requests', async () => {
    const { store, execute } = state();
    let complete!: (value: unknown) => void;
    execute.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    const loaded = store.transformGraphTypeToEditorFromDDL('people');
    const signal = execute.mock.calls[0][1].signal as AbortSignal;
    store.disposeReaction();
    complete({ code: 1 });
    await loaded;
    expect(signal.aborted).toBe(true);
    expect(store.nodeTypeList).toHaveLength(0);
  });

  it('restores only the newest graph type and keeps another editor isolated', async () => {
    const first = state();
    const second = state();
    let resolveOld!: (value: [INodeTypeItem[], IEdgeTypeItem[]]) => void;
    first.store.transformGrapTypeByDDL = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockResolvedValueOnce([[new INodeTypeItem({ name: 'New' })], []]);
    const pending = first.store.transformGraphTypeToEditorFromDDL('old');
    await first.store.transformGraphTypeToEditorFromDDL('new');
    resolveOld([[new INodeTypeItem({ name: 'Old' })], []]);
    await pending;
    expect(first.store.nodeTypeList.map((n) => n.name)).toEqual(['New']);
    expect(second.store.nodeTypeList).toHaveLength(0);
  });

  it('opens the schema when optional layout storage fails', async () => {
    const { store, read } = state();
    read.mockRejectedValueOnce(new Error('storage unavailable'));
    store.transformGrapTypeByDDL = vi.fn().mockResolvedValue([[new INodeTypeItem({ name: 'A' })], []]);
    await store.transformGraphTypeToEditorFromDDL('people');
    expect(store.nodeTypeList.map((n) => n.name)).toEqual(['A']);
    expect(store.savedLayout).toBeNull();
  });

  it.each(['DECIMAL', 'DECIMAL(12)', 'DECIMAL(256,128)'])('preserves %s metadata', async (data_type) => {
    const { store, execute } = state();
    store.updateGraphTypeName('payments');
    const node = new INodeTypeItem({ name: 'Payment' });
    const edge = new IEdgeTypeItem({ name: 'Pays', srcNode: node, dstNode: node });
    execute.mockResolvedValue({
      code: 0,
      data: {
        tables: [
          { type_name: 'Payment', property_name: 'amount', data_type, primary_key: 'Y', nullable: false },
          { type_name: 'Pays', property_name: 'amount', data_type, multi_edge_key: '', nullable: true },
        ],
      },
    });
    await store.updateNodeTypeItemProperty([node]);
    await store.updateEdgeTypeItemProperty([edge]);
    const expected = data_type === 'DECIMAL' ? [10, 0] : data_type === 'DECIMAL(12)' ? [12, 0] : [256, 128];
    for (const entity of [node, edge])
      expect([entity.properties[0].decimalPrecision, entity.properties[0].decimalScale]).toEqual(expected);
    expect(node.properties[0].isPrimaryKey).toBe(true);
    expect(edge.properties[0].nullable).toBe(true);
  });
});
