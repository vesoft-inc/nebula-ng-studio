// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useState, type DragEventHandler } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { themeStore } from '../../theme/index';
import type { ReactFlowInstance } from '@xyflow/react';
import { GraphTypeBuildMode, INodeTypeItem } from '../../schema/types';
import GraphTypeStore from '../SchemaEditorController';
import { GraphTypeStoreProvider } from '../context';
import GraphTypeBuilder from './index';
import type { ReactFlowEdge, ReactFlowNode } from './VisualBuilder/store';
import * as forceLayout from './VisualBuilder/forceLayout';

const mocks = vi.hoisted(() => ({ nodeCount: 1, flowInitializations: 0 }));
vi.mock('@vesoft-inc/icons', () => ({
  AddFilled: () => null,
  EditFilled: () => null,
  CloseFilled: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../shared/useModal', () => ({
  useModal: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}));
const services = {
  execute: async (gql: string) => ({
    code: 0,
    data: {
      tables: gql.startsWith('CALL describe_graph_type(')
        ? Array.from({ length: mocks.nodeCount }, (_, index) => ({
            entity_type: 'Node',
            type_name: `Person${index}`,
            labels: [],
          }))
        : [],
    },
  }),
  readSketch: async () => ({
    code: 0,
    data: {
      item: {
        name: 'people',
        schema: JSON.stringify({
          nodes: Array.from({ length: mocks.nodeCount }, (_, index) => ({ name: `Person${index}` })),
          edges: [],
        }),
      },
    },
  }),
  readGraphTypeLayout: async () => null,
  resolveSchemaPath: (...paths: string[]) => paths.find(Boolean),
  serializeNodePositions: (entries: { name: string; x: number; y: number }[]) =>
    Object.fromEntries(entries.filter((entry) => entry.name).map((entry) => [entry.name, { x: entry.x, y: entry.y }])),
};
vi.mock('../../shared/index', () => ({
  Drawer: () => null,
}));
vi.mock('../../shared/BreadCrumbs', () => ({ default: () => null }));
vi.mock('../../shared/TitleEllipsis', () => ({ default: () => null }));
vi.mock('./NodeType/index', () => ({ default: () => <div>Node table</div> }));
vi.mock('./EdgeType/index', () => ({ default: () => null }));
vi.mock('./LabelTable/index', () => ({ default: () => null }));
vi.mock('./Preview', () => ({ default: () => null }));
vi.mock('./VisualBuilder/ConfigForm', () => ({ ConfigForm: () => null }));
vi.mock('./VisualBuilder/GraphCornerButtons', () => ({
  GraphCornerButtons: ({ onZoomIn }: { onZoomIn: () => void }) => <button onClick={onZoomIn}>Zoom in</button>,
}));
vi.mock('@xyflow/react', async (original) => {
  const actual = await original<typeof import('@xyflow/react')>();
  const { useEffect, useRef } = await import('react');
  return {
    ...actual,
    ReactFlow: function MockReactFlow({
      onInit,
      onDrop,
      nodes,
    }: {
      onInit: (instance: ReactFlowInstance<ReactFlowNode, ReactFlowEdge>) => void;
      onDrop: DragEventHandler<HTMLDivElement>;
      nodes: ReactFlowNode[];
    }) {
      const initialized = useRef(false);
      useEffect(() => {
        // ReactFlow calls onInit once per mount, including StrictMode effect replay.
        if (initialized.current) return;
        initialized.current = true;
        mocks.flowInitializations += 1;
        onInit({
          zoomTo: vi.fn(),
          fitView: vi.fn(),
          zoomIn: vi.fn(),
          screenToFlowPosition: () => ({ x: 2000, y: 3000 }),
        } as unknown as ReactFlowInstance<ReactFlowNode, ReactFlowEdge>);
      }, []);
      return (
        <div
          data-testid="flow-drop"
          data-node-names={nodes.map((node) => node.data.nodeTypeItem.name).join(',')}
          onDrop={onDrop}
        />
      );
    },
  };
});

let store: GraphTypeStore;

beforeEach(() => {
  mocks.nodeCount = 1;
  mocks.flowInitializations = 0;
  store = new GraphTypeStore({ execute: services.execute as never, sketches: { read: services.readSketch } as never });
});

afterEach(() => {
  cleanup();
  store.destroySchemaStore();
  vi.restoreAllMocks();
});

function ControlledBuilder({ initialMode }: { initialMode: GraphTypeBuildMode }) {
  const [mode, setMode] = useState(initialMode);
  return (
    <GraphTypeBuilder
      mode={mode}
      graphTypeName={mode === GraphTypeBuildMode.Sketch ? undefined : 'people'}
      sketchId={mode === GraphTypeBuildMode.Sketch ? 1 : undefined}
      onEdit={() => setMode(GraphTypeBuildMode.Edit)}
      onView={() => setMode(GraphTypeBuildMode.Readonly)}
    />
  );
}

function mount(mode: 'view' | 'edit' | 'sketch' = 'view', strictMode = false) {
  const modes = {
    view: GraphTypeBuildMode.Readonly,
    edit: GraphTypeBuildMode.Edit,
    sketch: GraphTypeBuildMode.Sketch,
  };
  const builder = (
    <ThemeProvider theme={themeStore.theme}>
      <GraphTypeStoreProvider value={store}>
        <ControlledBuilder initialMode={modes[mode]} />
      </GraphTypeStoreProvider>
    </ThemeProvider>
  );
  return render(strictMode ? <StrictMode>{builder}</StrictMode> : builder);
}

describe('graph type canvas lifecycle', () => {
  it.each([false, true])('keeps the canvas usable across mode changes with StrictMode=%s', async (strictMode) => {
    const { unmount } = mount('view', strictMode);
    await waitFor(() => expect(store.canvasStore?.nodes).toHaveLength(1));
    await screen.findByRole('button', { name: 'Zoom in' });
    const instance = store.canvasStore!.instance;
    const readonlyCanvas = store.canvasStore;

    fireEvent.click(screen.getByRole('button', { name: 'editGraphType' }));
    await waitFor(() => expect(store.canvasStore).not.toBe(readonlyCanvas));
    await waitFor(() => expect(store.canvasStore?.instance).toBe(instance));
    expect(store.canvasStore?.readonly).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(instance!.zoomIn).toHaveBeenCalledOnce();

    const editableCanvas = store.canvasStore;
    fireEvent.click(screen.getByRole('button', { name: 'cancelEditGraphType' }));
    await waitFor(() => expect(store.canvasStore).not.toBe(editableCanvas));
    await waitFor(() => expect(store.canvasStore?.instance).toBe(instance));
    expect(store.canvasStore?.readonly).toBe(true);
    expect(mocks.flowInitializations).toBe(1);

    const lastCanvas = store.canvasStore;
    unmount();
    expect(lastCanvas?.instance).toBeNull();
    expect(readonlyCanvas?.instance).toBeNull();
    expect(editableCanvas?.instance).toBeNull();
  });

  it('keeps a dropped node at the pointer while synchronizing later edits', async () => {
    mount('edit');
    await waitFor(() => expect(store.canvasStore?.nodes).toHaveLength(1));
    await screen.findByRole('button', { name: 'Zoom in' });
    const originalPosition = { ...store.canvasStore!.nodes[0].position };

    fireEvent.drop(screen.getByTestId('flow-drop'), {
      dataTransfer: { getData: () => 'newNode' },
      clientX: 2000,
      clientY: 3000,
    });
    const newNode = store.schemaStore!.nodeTypeList[1];
    await waitFor(() => expect(store.canvasStore?.nodes).toHaveLength(2));
    expect(store.canvasStore!.nodes.find((node) => node.id === newNode.id)?.position).toEqual({ x: 1970, y: 2970 });
    expect(store.canvasStore!.nodes[0].position).toEqual(originalPosition);

    act(() => store.schemaStore!.updateNodeType(newNode.id, new INodeTypeItem({ name: 'Dropped' })));
    await waitFor(() => expect(screen.getByTestId('flow-drop').dataset.nodeNames).toBe('Person0,Dropped'));
    expect(store.canvasStore!.nodes.find((node) => node.id === newNode.id)?.position).toEqual({ x: 1970, y: 2970 });
  });

  it.each(['view', 'sketch'] as const)('waits for confirmation before laying out a large %s', async (mode) => {
    mocks.nodeCount = 5000;
    const layout = vi.spyOn(forceLayout, 'computeForceLayout').mockImplementation((nodes) => nodes);
    mount(mode);
    await screen.findByText('heavyGraphTitle');
    expect(layout).not.toHaveBeenCalled();
    expect(store.canvasStore?.nodes).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'nodeType' }));
    expect(screen.getByText('Node table')).toBeDefined();
    if (mode === 'sketch') {
      const firstNode = store.schemaStore!.nodeTypeList[0];
      act(() => store.schemaStore!.updateNodeType(firstNode.id, new INodeTypeItem({ name: 'Edited' })));
    }
    expect(layout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'visualBuilder' }));
    fireEvent.click(screen.getByRole('button', { name: 'heavyGraphConfirm' }));
    await waitFor(() => expect(store.canvasStore?.nodes).toHaveLength(5000));
    expect(layout).toHaveBeenCalledOnce();
    expect(layout.mock.calls[0][0]).toHaveLength(5000);
  });
});

it('supports an owned standalone editor through StrictMode replay', async () => {
  const { SchemaEditorWorkbench } = await import('../SchemaEditorWorkbench');
  const servicesForEditor = { execute: services.execute as never };
  const { rerender } = render(
    <StrictMode>
      <ThemeProvider theme={themeStore.theme}>
        <SchemaEditorWorkbench services={servicesForEditor} mode={GraphTypeBuildMode.Readonly} graphTypeName="people" />
      </ThemeProvider>
    </StrictMode>
  );
  await waitFor(() => expect(screen.getByTestId('flow-drop').getAttribute('data-node-names')).toBe('Person0'));
  rerender(
    <StrictMode>
      <ThemeProvider theme={themeStore.theme}>
        <SchemaEditorWorkbench services={servicesForEditor} mode={GraphTypeBuildMode.Create} />
      </ThemeProvider>
    </StrictMode>
  );
  await waitFor(() => expect(screen.getByTestId('flow-drop').getAttribute('data-node-names')).toBe(''));
});
