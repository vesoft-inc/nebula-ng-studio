// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observable } from 'mobx';
import { GraphEntityType, PropertyDataType, type DescGraphTypeResult } from '@vesoft-inc/studio-core/contracts';
import type { NodeObject } from '@vesoft-inc/force-graph';
import { UiProvider } from '../../provider';
import { ExplorerStore, exportSnapshotTransfer } from '../../explorer/ExplorerController';
import { ExplorerStoreProvider } from '../../explorer/context';
import GraphFilter from '../../explorer/Graph/SiderTools/Panels/GraphFilter';
import SchemaController from '../../schema/SchemaController';
import type { QueryExecutor } from '../../shared/query';
import { CommonGraphContent } from '../components/Content';
import { OperatorType } from '../constants';
import { ConditionFilter, type SnapshotData } from '../types/explorer';
import { RawEntityType } from '../types/gql';
import { VertexFilterDisplay } from './vertexFilter';
import { GraphWorkspaceStore } from './workspace';

vi.mock('../utils/layouts', () => ({ default: {} }));
vi.mock('../components/GraphTooltip/index', () => ({ initTooltip: () => () => {} }));
vi.mock('./two-graph', () => ({
  TwoGraphStore: class {
    render() {}
    destroy() {}
    resize() {}
    instance = { graphData: () => ({ nodes: [], links: [] }) };
  },
}));

const workspaces: GraphWorkspaceStore[] = [];
const explorers: ExplorerStore[] = [];
afterEach(() => {
  cleanup();
  workspaces.splice(0).forEach((workspace) => workspace.destroy());
  explorers.splice(0).forEach((explorer) => {
    explorer.destroy();
    explorer.schemaStore.destroy();
  });
});

const person: DescGraphTypeResult = {
  type_name: 'Person',
  entity_type: GraphEntityType.Node,
  labels: [],
  properties: ['name'],
  'primary_key/multiedge_key': ['name'],
  propertyInfos: [
    {
      type_name: 'Person',
      type: GraphEntityType.Node,
      property_name: 'name',
      data_type: PropertyDataType.STRING,
      primary_key: 'Y',
      nullable: false,
      default: '',
    },
  ],
};
function node(id: string): NodeObject {
  return {
    id,
    data: {
      raw: id,
      type: RawEntityType.NODE,
      value: { id: 1, graph: 'demo', type: 'Person', labels: [], properties: { name: id } },
    },
  };
}
function filter(value = 'a') {
  return new ConditionFilter({
    entity: person,
    entity_name: 'Person',
    property: person.propertyInfos[0],
    property_name: 'name',
    value,
    operator: OperatorType.Equal,
    enable: true,
  });
}
function savedData(filterType?: VertexFilterDisplay): SnapshotData {
  const nodes = [node('a'), node('b')];
  return {
    nodes,
    links: [],
    nodesSelected: observable.set([]),
    linksSelected: observable.set([]),
    displayedNodePropertyItems: observable.array([]),
    displayedEdgePropertyItems: observable.array([]),
    filterList: observable.array([filter()]),
    filterType,
    nowDataMap: new Map(nodes.map((item) => [item.id!, item])),
    imagesCache: new Map(),
  };
}
function workspace() {
  const execute = vi.fn<QueryExecutor>().mockResolvedValue({ code: 0, message: '', data: { tables: [] } });
  const value = new GraphWorkspaceStore({ explorerId: 'test', execGql: execute as QueryExecutor });
  value.graphTypeDetails = [person];
  workspaces.push(value);
  return value;
}
function explorer(workspace?: GraphWorkspaceStore) {
  const services = {
    execute: vi.fn<QueryExecutor>() as QueryExecutor,
    snapshots: { list: vi.fn(), read: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
  const schemaStore = new SchemaController(services);
  const value = new ExplorerStore({ settings: {}, schemaStore, services });
  if (workspace) value.updateGraphWorkspace(workspace);
  explorers.push(value);
  return value;
}

describe('graph history', () => {
  it('discards the old redo branch when adding data after undo', () => {
    const { graph } = workspace();
    for (const id of ['a', 'b', 'c']) graph.upsertNodesAndEdges({ vertexes: [node(id)], edges: [] });
    graph.undo();
    graph.undo();
    graph.upsertNodesAndEdges({ vertexes: [node('d')], edges: [] });
    expect(graph.historyLength).toBe(3);
    expect(graph.historyIndex).toBe(2);
    graph.undo();
    expect([...graph.nodes].map((item) => item.id)).toEqual(['a']);
    graph.redo();
    expect([...graph.nodes].map((item) => item.id)).toEqual(['a', 'd']);
    expect([...graph.nowDataMap.keys()]).toEqual(['a', 'd']);
    graph.undo();
    graph.undo();
    expect(graph.nodes.size).toBe(0);
    graph.redo();
    graph.redo();
    expect([...graph.nodes].map((item) => item.id)).toEqual(['a', 'd']);
  });
});

describe('saved graph filters', () => {
  it.each([VertexFilterDisplay.Hide, VertexFilterDisplay.Grayscale])(
    'round-trips %s mode without marking the restored snapshot dirty',
    (mode) => {
      const original = workspace().graph;
      original.recoverSnapShotData(savedData(mode));
      const serialized = JSON.stringify(exportSnapshotTransfer(original.toSnapShotData()));
      expect(JSON.parse(serialized).filterType).toBe(mode);
      const restored = workspace().graph;
      const revision = restored.snapshotRevision;
      restored.recoverSnapShotData(explorer().importSnapshotTransfer(serialized)!);
      expect(restored.vertexFilterStore.filterType).toBe(mode);
      expect([...restored.vertexFilterStore.entityIdsFilterInfo.get(mode)!]).toEqual(['b']);
      expect(restored.shouldBlockRouter).toBe(false);
      expect(restored.snapshotRevision).toBe(revision);
    }
  );

  it('defaults old snapshots to grayscale even after using hide mode', () => {
    const graph = workspace().graph;
    graph.vertexFilterStore.setFilterType(VertexFilterDisplay.Hide);
    graph.markSnapshotSaved(graph.snapshotRevision);
    const revision = graph.snapshotRevision;
    const serialized = exportSnapshotTransfer(savedData());
    delete serialized.filterType;
    graph.recoverSnapShotData(explorer().importSnapshotTransfer(JSON.stringify(serialized))!);
    expect(graph.vertexFilterStore.filterType).toBe(VertexFilterDisplay.Grayscale);
    expect([...graph.vertexFilterStore.entityIdsGreyScaledSet]).toEqual(['b']);
    expect(graph.vertexFilterStore.entityIdsHideSet.size).toBe(0);
    expect(graph.shouldBlockRouter).toBe(false);
    expect(graph.snapshotRevision).toBe(revision);
  });

  it('tracks user mode changes and prevents a pending save from clearing newer edits', () => {
    const graph = workspace().graph;
    graph.recoverSnapShotData(savedData());
    const revision = graph.snapshotRevision;
    graph.vertexFilterStore.setFilterType(VertexFilterDisplay.Hide);
    expect([...graph.vertexFilterStore.entityIdsHideSet]).toEqual(['b']);
    expect(graph.vertexFilterStore.entityIdsGreyScaledSet.size).toBe(0);
    expect(graph.snapshotRevision).toBe(revision + 1);
    expect(graph.markSnapshotSaved(revision)).toBe(false);
    expect(graph.shouldBlockRouter).toBe(true);
    graph.vertexFilterStore.setFilterType(VertexFilterDisplay.Hide);
    expect(graph.snapshotRevision).toBe(revision + 1);
  });

  it('reopens the filter panel with the stored mode and marks only user changes dirty', () => {
    const value = workspace();
    value.graph.recoverSnapShotData(savedData(VertexFilterDisplay.Hide));
    const controller = explorer(value);
    const content = (
      <UiProvider locale="en_US">
        <ExplorerStoreProvider value={controller}>
          <GraphFilter />
        </ExplorerStoreProvider>
      </UiProvider>
    );
    const first = render(content);
    expect((screen.getByRole('radio', { name: 'Hide' }) as HTMLInputElement).checked).toBe(true);
    expect(value.graph.shouldBlockRouter).toBe(false);
    first.unmount();
    render(content);
    expect((screen.getByRole('radio', { name: 'Hide' }) as HTMLInputElement).checked).toBe(true);
    expect(value.graph.shouldBlockRouter).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'Dismiss' }));
    expect(value.graph.vertexFilterStore.filterType).toBe(VertexFilterDisplay.Grayscale);
    expect([...value.graph.vertexFilterStore.entityIdsGreyScaledSet]).toEqual(['b']);
    expect(value.graph.shouldBlockRouter).toBe(true);
  });
});

describe('filter reaction lifecycle', () => {
  it('applies filters before a canvas is mounted', () => {
    const { graph } = workspace();
    graph.recoverSnapShotData(savedData());
    expect([...graph.vertexFilterStore.entityIdsGreyScaledSet]).toEqual(['b']);
  });

  it.each([false, true])('restores and updates filters after canvas mount with StrictMode=%s', (strict) => {
    const value = workspace();
    const content = (
      <UiProvider>
        <CommonGraphContent
          explorerItem={value}
          onInitGraph={({ initGraph }) => {
            initGraph();
          }}
        />
      </UiProvider>
    );
    const view = render(strict ? <StrictMode>{content}</StrictMode> : content);
    act(() => value.graph.recoverSnapShotData(savedData()));
    expect([...value.graph.vertexFilterStore.entityIdsGreyScaledSet]).toEqual(['b']);
    act(() => value.graph.updateFilterList([filter('b')]));
    expect([...value.graph.vertexFilterStore.entityIdsGreyScaledSet]).toEqual(['a']);
    view.unmount();
    expect(value.graph.filterListDisposer).toBeUndefined();
    value.graph.vertexFilterStore.entityIdsGreyScaledSet.clear();
    value.graph.recoverSnapShotData(savedData());
    expect(value.graph.vertexFilterStore.entityIdsGreyScaledSet.size).toBe(0);
  });
});
