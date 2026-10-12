// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { runInAction } from 'mobx';
import { ThemeProvider } from '@mui/material/styles';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem, IProperty } from '@studio/interfaces';
import SchemaStore from '@studio/stores/graphtype/schema';
import NodeTypeConfigModal from './NodeType/NodeTypeConfigModal';
import EdgeTypeConfigModal from './EdgeType/EdgeTypeConfigModal';
import VisualBuilder from './VisualBuilder';
import { generateAlterGraphTypeGQL } from './VisualBuilder/util';
import { activeItem, setActiveItem } from './VisualBuilder/store';
import { VisualEditorType } from '@studio/utils/constant';

const mocks = vi.hoisted(() => ({ schema: undefined as unknown as SchemaStore }));
vi.mock('@studio/stores', () => ({
  useStore: () => ({
    graphtypeStore: { schemaStore: mocks.schema, mode: GraphTypeBuildMode.Edit },
    schemaStore: { currentSchema: { path: '/default_schema' } },
    commonStore: { userInfo: {} },
  }),
}));
vi.mock('@studio/services', () => ({ resolveSchemaPath: () => '/default_schema' }));
vi.mock('@vesoft-inc/icons', () => ({
  AddFilled: () => null,
  CloseFilled: () => null,
  MoreVertFilled: () => null,
  HelpCircleOutline: () => null,
  ContentCopyFilled: () => null,
  DeleteOutline: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), Trans: () => null }));
vi.mock('@vesoft-inc/ui-components', () => ({
  Modal: ({
    open,
    children,
    onOk,
    onCancel,
  }: React.PropsWithChildren<{ open: boolean; onOk: () => void; onCancel: () => void }>) =>
    open ? (
      <div role="dialog">
        {children}
        <button onClick={onOk}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
  Drawer: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) =>
    open ? <section aria-label="Node editor">{children}</section> : null,
}));
vi.mock('./VisualBuilder/GraphCornerButtons', () => ({ GraphCornerButtons: () => null }));
vi.mock('./VisualBuilder/useForceLayout', () => ({ useForceLayout: () => ({ stopSimulation: vi.fn() }) }));
vi.mock('./VisualBuilder/useLayoutPersistence', () => ({ useLayoutPersistence: () => undefined }));
vi.mock('./VisualBuilder/GraphCanvas', async () => {
  const { useEffect } = await import('react');
  const { reactFlowInstance } = await import('./VisualBuilder/store');
  return {
    GraphCanvas: function MockCanvas({ onNodeClick }: { onNodeClick: (event: unknown, node: unknown) => void }) {
      useEffect(() => {
        runInAction(() => reactFlowInstance.set({ fitView: vi.fn() } as never));
        return () => runInAction(() => reactFlowInstance.set(null));
      }, []);
      return (
        <button onClick={() => onNodeClick(null, { data: { nodeTypeItem: mocks.schema.nodeTypeList[0] } })}>
          Open node
        </button>
      );
    },
  };
});

function Editor({ withCanvas = false, edge = false }: { withCanvas?: boolean; edge?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <ThemeProvider theme={themeStore.theme}>
      {withCanvas && <VisualBuilder />}
      <button onClick={() => setOpen(true)}>Edit node</button>
      {edge ? (
        <EdgeTypeConfigModal open={open} edgeTypeItem={mocks.schema.edgeTypeList[0]} onCancel={() => setOpen(false)} />
      ) : (
        <NodeTypeConfigModal open={open} nodeTypeItem={mocks.schema.nodeTypeList[0]} onCancel={() => setOpen(false)} />
      )}
    </ThemeProvider>
  );
}

beforeEach(() => {
  mocks.schema = new SchemaStore();
  const original = new INodeTypeItem({
    name: 'Person',
    properties: [new IProperty({ name: 'id', isPrimaryKey: true })],
  });
  mocks.schema.originalNodeTypeList = [original];
  mocks.schema.updateNodeTypeList([new INodeTypeItem(original)]);
});
afterEach(() => {
  cleanup();
  mocks.schema.disposeReaction();
});

const addProperty = async (user: ReturnType<typeof userEvent.setup>, name: string, root: HTMLElement) => {
  await user.click(within(root).getByRole('button', { name: 'addProperty' }));
  const inputs = within(root).getAllByRole('textbox', { name: /propName/ });
  await user.type(inputs[inputs.length - 1], name);
};

describe('existing node editing', () => {
  it.each([false, true])(
    'does not generate property changes for an untouched form with canvas=%s',
    async (withCanvas) => {
      const user = userEvent.setup();
      render(<Editor withCanvas={withCanvas} />);
      if (withCanvas) await user.click(screen.getByRole('button', { name: 'Open node' }));
      await user.click(screen.getByRole('button', { name: 'Edit node' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const ddl = generateAlterGraphTypeGQL(
        { graphTypeName: 'people', nodeTypeList: mocks.schema.originalNodeTypeList, edgeTypeList: [] },
        { graphTypeName: 'people', nodeTypeList: mocks.schema.nodeTypeList.slice(), edgeTypeList: [] }
      );
      expect(ddl).toBe('');
    }
  );

  it('allows key selection on a newly added node while editing an existing graph type', async () => {
    mocks.schema.originalNodeTypeList = [];
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Edit node' }));
    const key = screen.getByRole('checkbox', { name: 'primaryKey: id' }) as HTMLInputElement;
    expect(key.disabled).toBe(false);
    await user.click(key);
    expect(screen.getByRole('status').textContent).toBe('nodePrimaryKeyRequired');
  });

  it('keeps property identities through rename, addition, save and reopening', async () => {
    const originalKeyId = mocks.schema.nodeTypeList[0].properties[0].id;
    const user = userEvent.setup();
    render(<Editor withCanvas />);
    await user.click(screen.getByRole('button', { name: 'Edit node' }));
    const dialog = screen.getByRole('dialog');
    const name = within(dialog).getByRole('textbox', { name: /propName/ });
    await user.clear(name);
    await user.type(name, 'person_id');
    await addProperty(user, 'email', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const node = mocks.schema.nodeTypeList[0];
    expect(node.properties[0].id).toBe(originalKeyId);
    expect(node.properties[0].isPrimaryKey).toBe(true);
    const newId = node.properties[1].id;
    await user.click(screen.getByRole('button', { name: 'Open node' }));
    expect(node.properties[1].id).toBe(newId);
    const ddl = generateAlterGraphTypeGQL(
      { graphTypeName: 'people', nodeTypeList: mocks.schema.originalNodeTypeList, edgeTypeList: [] },
      { graphTypeName: 'people', nodeTypeList: [node], edgeTypeList: [] }
    );
    expect(ddl).toContain('ADD PROPERTIES {`email` STRING}');
    expect(ddl).toContain('RENAME PROPERTIES {`id` TO `person_id`}');
    expect(ddl).not.toContain('MODIFY PROPERTIES');
    expect(ddl).not.toContain('DROP PROPERTIES');
  });

  it('locks the existing key definition while leaving regular property additions editable', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Edit node' }));
    const dialog = screen.getByRole('dialog');
    const key = within(dialog).getByRole('checkbox', { name: 'primaryKey: id' }) as HTMLInputElement;
    expect(key.checked).toBe(true);
    expect(key.disabled).toBe(true);
    expect((within(dialog).getByRole('combobox', { name: /propType/ }) as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'delete: id' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(key);
    expect(key.checked).toBe(true);
    await addProperty(user, 'email', dialog);
    expect((within(dialog).getByRole('checkbox', { name: 'primaryKey: email' }) as HTMLInputElement).disabled).toBe(
      true
    );
    expect((within(dialog).getAllByRole('combobox', { name: /propType/ })[1] as HTMLInputElement).disabled).toBe(false);
    expect((within(dialog).getByRole('button', { name: 'delete: email' }) as HTMLButtonElement).disabled).toBe(false);
    await user.hover(within(dialog).getByRole('button', { name: 'primaryKey' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe('nodePrimaryKeyImmutableHelp');
  });

  it('canceling a modal edit leaves existing property values and the DDL baseline untouched', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Edit node' }));
    const dialog = screen.getByRole('dialog');
    const name = within(dialog).getByRole('textbox', { name: /propName/ });
    await user.clear(name);
    await user.type(name, 'renamed_id');
    await addProperty(user, 'email', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(mocks.schema.nodeTypeList[0].properties.map((p) => p.name)).toEqual(['id']);
    expect(mocks.schema.originalNodeTypeList[0].properties.map((p) => p.name)).toEqual(['id']);
  });

  it.each([false, true])('retains properties across two modal saves with canvas=%s', async (withCanvas) => {
    const user = userEvent.setup();
    render(<Editor withCanvas={withCanvas} />);
    if (withCanvas) await user.click(screen.getByRole('button', { name: 'Open node' }));
    for (const name of ['email', 'phone']) {
      await user.click(screen.getByRole('button', { name: 'Edit node' }));
      const dialog = screen.getByRole('dialog');
      await addProperty(user, name, dialog);
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(mocks.schema.nodeTypeList[0].properties.map((p) => p.name)).toContain(name);
    }
    expect(mocks.schema.nodeTypeList[0].properties.map((p) => p.name)).toEqual(['id', 'email', 'phone']);
    const ddl = generateAlterGraphTypeGQL(
      { graphTypeName: 'people', nodeTypeList: mocks.schema.originalNodeTypeList, edgeTypeList: [] },
      { graphTypeName: 'people', nodeTypeList: mocks.schema.nodeTypeList.slice(), edgeTypeList: [] }
    );
    expect(ddl).toContain('ADD PROPERTIES {`email` STRING,`phone` STRING}');
  });

  it('retains canvas edits when subsequently adding properties in the modal and reopening', async () => {
    const user = userEvent.setup();
    render(<Editor withCanvas />);
    await user.click(screen.getByRole('button', { name: 'Open node' }));
    const editor = await screen.findByRole('region', { name: 'Node editor' });
    await addProperty(user, 'email', editor);
    expect(mocks.schema.nodeTypeList[0].properties.map((p) => p.name)).toEqual(['id', 'email']);
    await user.click(screen.getByRole('button', { name: 'Edit node' }));
    const dialog = screen.getByRole('dialog');
    await addProperty(user, 'phone', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Open node' }));
    expect(mocks.schema.nodeTypeList[0].properties.map((p) => p.name)).toEqual(['id', 'email', 'phone']);
    expect(
      within(screen.getByRole('region', { name: 'Node editor' }))
        .getAllByRole('textbox', { name: /propName/ })
        .map((input) => (input as HTMLInputElement).value)
    ).toEqual(['id', 'email', 'phone']);
  });
});

describe('existing edge editing', () => {
  it('isolates canceled edits and retains sequential additions when the canvas editor is mounted', async () => {
    const node = mocks.schema.nodeTypeList[0];
    const original = new IEdgeTypeItem({
      name: 'Knows',
      srcNode: node,
      dstNode: node,
      properties: [new IProperty({ name: 'since' })],
    });
    mocks.schema.originalEdgeTypeList = [original];
    const edge = new IEdgeTypeItem({
      ...original,
      id: original.id,
      properties: original.properties.map((p) => new IProperty(p)),
    });
    mocks.schema.updateEdgeTypeList([edge]);
    const user = userEvent.setup();
    render(<Editor withCanvas edge />);
    await user.click(screen.getByRole('button', { name: 'Edit node' }));
    let dialog = screen.getByRole('dialog');
    const input = within(dialog).getByRole('textbox', { name: /propName/ });
    await user.clear(input);
    await user.type(input, 'discarded');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(edge.properties[0].name).toBe('since');
    for (const name of ['notes', 'source']) {
      act(() => setActiveItem({ type: VisualEditorType.Edge, value: edge }));
      await user.click(screen.getByRole('button', { name: 'Edit node' }));
      expect(activeItem.get()).toBeNull();
      dialog = screen.getByRole('dialog');
      await addProperty(user, name, dialog);
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    expect(edge.properties.map((p) => p.name)).toEqual(['since', 'notes', 'source']);
    expect(original.properties.map((p) => p.name)).toEqual(['since']);
    const ddl = generateAlterGraphTypeGQL(
      { graphTypeName: 'people', nodeTypeList: [node], edgeTypeList: [original] },
      { graphTypeName: 'people', nodeTypeList: [node], edgeTypeList: [edge] }
    );
    expect(ddl).toContain('ALTER EDGE `Knows` ADD PROPERTIES {`notes` STRING,`source` STRING}');
    expect(ddl).not.toContain('MODIFY PROPERTIES');
  });
});
