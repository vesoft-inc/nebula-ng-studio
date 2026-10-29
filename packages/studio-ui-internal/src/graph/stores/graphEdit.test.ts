// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  GraphEntityType,
  PropertyDataType,
  type DescGraphTypeResult,
  type ServerResponse,
} from '@vesoft-inc/studio-core/contracts';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { QueryExecutor } from '../../shared/query';
import { RawEntityType } from '../types/gql';
import { GraphWorkspaceStore } from './workspace';

vi.mock('../utils/layouts', () => ({ default: {} }));

const workspaces: GraphWorkspaceStore[] = [];
afterEach(() => workspaces.splice(0).forEach((workspace) => workspace.destroy()));

const success = { code: 0, message: '', data: { tables: [] } };
function deferred() {
  let resolve!: (value: ServerResponse<object>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ServerResponse<object>>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup(kind: 'node' | 'edge', mode: 'add' | 'edit') {
  const write = deferred();
  const read = deferred();
  const execute = vi.fn<QueryExecutor>().mockResolvedValue(success).mockReturnValueOnce(write.promise);
  if (mode === 'add') execute.mockReturnValueOnce(read.promise);
  const workspace = new GraphWorkspaceStore({ explorerId: 'edit', execGql: execute as QueryExecutor });
  workspaces.push(workspace);
  workspace.updateCurrentSnapshot({
    id: 'edit',
    name: 'Edit',
    graph: 'demo',
    graph_type: '',
    schemaPath: '/demo',
    created_at: '',
    updated_at: '',
  });
  const person: DescGraphTypeResult = {
    entity_type: GraphEntityType.Node,
    type_name: 'Person',
    labels: [],
    properties: ['id', 'name'],
    'primary_key/multiedge_key': ['id'],
    propertyInfos: ['id', 'name'].map((property_name) => ({
      type_name: 'Person',
      type: GraphEntityType.Node,
      property_name,
      data_type: PropertyDataType.STRING,
      primary_key: property_name === 'id' ? 'Y' : '',
      nullable: false,
      default: '',
    })),
  };
  workspace.graphTypeDetails = [
    person,
    {
      entity_type: GraphEntityType.Edge,
      type_name: 'Knows',
      labels: [],
      properties: ['name'],
      'primary_key/multiedge_key': 'Unique',
      type_pattern: '(Person)-[Knows]->(Person)',
      propertyInfos: [
        {
          type_name: 'Knows',
          type: GraphEntityType.Edge,
          property_name: 'name',
          data_type: PropertyDataType.STRING,
          multi_edge_key: '',
          nullable: false,
          default: '',
        },
      ],
    },
  ];
  const nodes: NodeObject[] = [1, 2].map((id) => ({
    id: String(id),
    data: {
      raw: String(id),
      type: RawEntityType.NODE,
      value: { id, graph: 'demo', type: 'Person', labels: [], properties: { id: String(id), name: 'before' } },
    },
  }));
  const link: LinkObject = {
    id: 'edge',
    source: nodes[0],
    target: nodes[1],
    data: {
      raw: 'edge',
      type: RawEntityType.EDGE,
      value: {
        srcId: 1,
        dstId: 2,
        graph: 'demo',
        type: 'Knows',
        labels: [],
        rank: 0,
        isDirected: true,
        properties: { name: 'before' },
      },
    },
  };
  workspace.graph.initData({ nodes, links: [link] });
  const { graphEdit } = workspace;
  if (mode === 'edit') graphEdit.openEditEntity(kind === 'node' ? nodes[0] : link);
  else if (kind === 'node') graphEdit.openAddNode('Person');
  else {
    workspace.graph.selectNodes(nodes);
    graphEdit.openAddEdge();
  }
  return { workspace, graphEdit, execute, write, read, nodes, link };
}

describe('graph edit submissions', () => {
  it.each([
    ['node', 'add'],
    ['node', 'edit'],
    ['edge', 'add'],
    ['edge', 'edit'],
  ] as const)(
    'keeps %s %s busy through the write and readback and rejects duplicate submissions',
    async (kind, mode) => {
      const { graphEdit, execute, write, read, nodes, link } = setup(kind, mode);
      const values = { id: '1', name: 'after' };
      const pending = graphEdit.submit(values);
      expect(graphEdit.submitting).toBe(true);
      await expect(graphEdit.submit(values)).resolves.toEqual({ ok: false });
      expect(execute).toHaveBeenCalledOnce();
      write.resolve(success);
      if (mode === 'add') {
        await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
        expect(graphEdit.submitting).toBe(true);
        await expect(graphEdit.submit(values)).resolves.toEqual({ ok: false });
        read.resolve(success);
      }
      await expect(pending).resolves.toEqual({ ok: true });
      expect(graphEdit.submitting).toBe(false);
      expect(graphEdit.modal).toBeUndefined();
      expect(execute).toHaveBeenCalledTimes(mode === 'add' ? 2 : 1);
      if (mode === 'edit') expect((kind === 'node' ? nodes[0] : link).data.value.properties.name).toBe('after');
    }
  );

  it.each(['response', 'transport'] as const)(
    'releases the busy state and permits retry after a %s failure',
    async (failure) => {
      const { graphEdit, write, execute } = setup('node', 'edit');
      const pending = graphEdit.submit({ name: 'after' });
      if (failure === 'transport') {
        write.reject(new Error('offline'));
        await expect(pending).rejects.toThrow('offline');
      } else {
        write.resolve({ code: 1, message: 'write failed' });
        await expect(pending).resolves.toEqual({ ok: false });
      }
      expect(graphEdit.submitting).toBe(false);
      expect(graphEdit.modal).toBeDefined();
      await expect(graphEdit.submit({ name: 'after' })).resolves.toEqual({ ok: true });
      expect(execute).toHaveBeenCalledTimes(2);
    }
  );

  it('does not enter the busy state or send writes for invalid values', async () => {
    const { graphEdit, execute } = setup('node', 'add');
    expect((await graphEdit.submit({ id: '', name: '' })).errors).toBeDefined();
    expect(graphEdit.submitting).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('ignores duplicate delete confirmation while a delete is pending', async () => {
    const { graphEdit, workspace, nodes, write, execute } = setup('node', 'edit');
    graphEdit.openDeleteConfirm([nodes[0]]);
    const pending = graphEdit.confirmDelete();
    expect(graphEdit.submitting).toBe(true);
    await graphEdit.confirmDelete();
    expect(execute).toHaveBeenCalledOnce();
    write.resolve(success);
    await pending;
    expect(graphEdit.submitting).toBe(false);
    expect(graphEdit.modal).toBeUndefined();
    expect([...workspace.graph.nodes].map((node) => node.id)).toEqual(['2']);
  });
});
