// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { themeStore } from '../../theme/index';
import { PropertyDataType } from '@vesoft-inc/studio-core/contracts';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem, IProperty } from '../../schema/types';
import SchemaStore from '../SchemaEditorState';
import NodeTypeConfigModal from './NodeType/NodeTypeConfigModal';
import EdgeTypeConfigModal from './EdgeType/EdgeTypeConfigModal';
import VisualBuilder from './VisualBuilder/index';
import { generateAlterGraphTypeGQL, generateCreateGraphTypeGQL } from './VisualBuilder/util';
import { CanvasStore } from './VisualBuilder/store';
import { VisualEditorType } from '../../shared/constants';

const mocks = vi.hoisted(() => ({
  schema: undefined as unknown as SchemaStore,
  canvas: undefined as unknown as CanvasStore,
}));
vi.mock('../context', () => ({
  useGraphTypeStore: () => ({
    services: mocks.schema.services,
    schemaStore: mocks.schema,
    canvasStore: mocks.canvas,
    mode: GraphTypeBuildMode.Edit,
  }),
}));
vi.mock('@vesoft-inc/icons', () => ({
  AddFilled: () => null,
  CloseFilled: () => null,
  MoreVertFilled: () => <span>More</span>,
  HelpCircleOutline: () => null,
  ContentCopyFilled: () => null,
  DeleteOutline: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), Trans: () => null }));
vi.mock('../../shared/index', () => ({
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
  return {
    GraphCanvas: function MockCanvas({ onNodeClick }: { onNodeClick: (event: unknown, node: unknown) => void }) {
      useEffect(() => {
        mocks.canvas.setInstance({ fitView: vi.fn() } as never);
        return () => mocks.canvas.setInstance(null);
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
  mocks.canvas = new CanvasStore();
  mocks.schema = new SchemaStore({ execute: vi.fn() });
  mocks.schema.attachCanvas(mocks.canvas);
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
    expect(key.closest('.MuiCheckbox-root')?.classList.contains('Mui-disabled')).toBe(true);
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
      act(() => mocks.canvas.setActiveItem({ type: VisualEditorType.Edge, value: edge }));
      await user.click(screen.getByRole('button', { name: 'Edit node' }));
      expect(mocks.canvas.activeItem).toBeNull();
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

describe('DECIMAL form round trips', () => {
  it('does not MODIFY an existing DECIMAL key with implicit defaults after saving its form', async () => {
    const node = new INodeTypeItem({
      name: 'Person',
      properties: [new IProperty({ name: 'id', type: PropertyDataType.DECIMAL, isPrimaryKey: true })],
    });
    mocks.schema.originalNodeTypeList = [node];
    mocks.schema.updateNodeTypeList([new INodeTypeItem(node)]);
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Edit node' }));
    await addProperty(user, 'extra', screen.getByRole('dialog'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      generateAlterGraphTypeGQL(
        { graphTypeName: 'people', nodeTypeList: [node], edgeTypeList: [] },
        { graphTypeName: 'people', nodeTypeList: mocks.schema.nodeTypeList.slice(), edgeTypeList: [] }
      )
    ).toBe('ALTER GRAPH TYPE `people` {\n  ALTER NODE `Person` ADD PROPERTIES {`extra` STRING}\n}');
  });

  it('does not retain stale decimal errors after switching to a scalar type', async () => {
    const node = mocks.schema.nodeTypeList[0];
    node.properties.push(new IProperty({ name: 'amount', type: PropertyDataType.DECIMAL, decimalPrecision: 257 }));
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Edit node' }));
    const dialog = screen.getByRole('dialog');
    await user.click(
      within(dialog)
        .getAllByRole('button', { name: /More|propertySettings/ })
        .at(-1)!
    );
    await user.keyboard('{Escape}');
    const type = within(dialog)
      .getAllByRole('combobox', { name: /propType/ })
      .at(-1)!;
    await user.click(type);
    await user.click(screen.getByRole('option', { name: 'STRING' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(node.properties[1].type).toBe(PropertyDataType.STRING);
  });

  it('blocks invalid DECIMAL edited in the real canvas before DDL validation', async () => {
    const node = mocks.schema.nodeTypeList[0];
    node.properties.push(
      new IProperty({ name: 'amount', type: PropertyDataType.DECIMAL, decimalPrecision: 12, decimalScale: 0 })
    );
    const user = userEvent.setup();
    render(<Editor withCanvas />);
    await user.click(screen.getByRole('button', { name: 'Open node' }));
    const editor = await screen.findByRole('region', { name: 'Node editor' });
    await user.click(
      within(editor)
        .getAllByRole('button', { name: /More|propertySettings/ })
        .at(-1)!
    );
    fireEvent.change(screen.getByRole('spinbutton', { name: 'decimalPrecision', hidden: true }), {
      target: { value: '257' },
    });
    await waitFor(() => expect(node.properties[1].decimalPrecision).toBe(257));
    const { validateGraphTypeDecimals } = await import('./validation');
    expect(validateGraphTypeDecimals(mocks.schema.nodeTypeList.slice(), [])).toHaveLength(1);
  });

  it.each([false, true])(
    'validates decimal boundaries and cleared inputs in the real form with edge=%s',
    async (edge) => {
      const node = mocks.schema.nodeTypeList[0];
      const amount = new IProperty({
        name: 'amount',
        type: PropertyDataType.DECIMAL,
        decimalPrecision: 12,
        decimalScale: 0,
      });
      if (edge)
        mocks.schema.updateEdgeTypeList([
          new IEdgeTypeItem({ name: 'Pays', srcNode: node, dstNode: node, properties: [amount] }),
        ]);
      else node.properties.push(amount);
      const user = userEvent.setup();
      render(<Editor edge={edge} />);
      await user.click(screen.getByRole('button', { name: 'Edit node' }));
      const dialog = screen.getByRole('dialog');
      const buttons = within(dialog).getAllByRole('button', { name: /More|propertySettings/ });
      await user.click(buttons[buttons.length - 1]);
      const [precision, scale] = screen.getAllByRole('spinbutton', { hidden: true }) as HTMLInputElement[];
      for (const [p, s, invalid] of [
        ['256', '128', false],
        ['257', '128', true],
        ['12', '13', true],
        ['12', '0', false],
        ['12.5', '0', true],
        ['', '11', true],
        ['', '', false],
        ['1', '0', false],
      ] as const) {
        await user.clear(precision);
        if (p) await user.type(precision, p);
        await user.clear(scale);
        if (s) await user.type(scale, s);
        await waitFor(() =>
          expect(
            precision.getAttribute('aria-invalid') === 'true' || scale.getAttribute('aria-invalid') === 'true'
          ).toBe(invalid)
        );
      }
      await user.keyboard('{Escape}');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const property = (edge ? mocks.schema.edgeTypeList[0] : node).properties.find((p) => p.name === 'amount');
      expect(property).toMatchObject({ decimalPrecision: 1, decimalScale: 0 });
    }
  );

  it('keeps disabled key values in submissions and applies MUI disabled styles', async () => {
    const original = new INodeTypeItem({
      name: 'Payment',
      properties: [
        new IProperty({
          name: 'id',
          type: PropertyDataType.DECIMAL,
          decimalPrecision: 12,
          decimalScale: 0,
          isPrimaryKey: true,
          nullable: false,
        }),
      ],
    });
    mocks.schema.originalNodeTypeList = [original];
    mocks.schema.updateNodeTypeList([new INodeTypeItem(original)]);
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Edit node' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /More|propertySettings/ }));
    const [precision, scale] = screen.getAllByRole('spinbutton', { hidden: true }) as HTMLInputElement[];
    for (const field of [precision, scale]) {
      expect(field.disabled).toBe(true);
      expect(field.closest('.MuiInputBase-root')?.classList.contains('Mui-disabled')).toBe(true);
    }
    const nullable = screen.getByRole('checkbox', { name: 'nullable', hidden: true }) as HTMLInputElement;
    expect(nullable.disabled).toBe(true);
    expect(nullable.closest('.MuiCheckbox-root')?.classList.contains('Mui-disabled')).toBe(true);
    await user.keyboard('{Escape}');
    await addProperty(user, 'note', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.schema.nodeTypeList[0].properties[0]).toMatchObject({
      type: PropertyDataType.DECIMAL,
      isPrimaryKey: true,
      nullable: false,
      decimalPrecision: 12,
      decimalScale: 0,
    });
    expect(mocks.schema.nodeTypeList[0].properties.map((p) => p.name)).toEqual(['id', 'note']);
  });

  it.each([false, true])(
    'blocks invalid decimal on save without ever opening advanced settings with edge=%s',
    async (edge) => {
      const node = mocks.schema.nodeTypeList[0];
      const property = new IProperty({ name: 'bad', type: PropertyDataType.DECIMAL, decimalPrecision: 0 });
      if (edge)
        mocks.schema.updateEdgeTypeList([
          new IEdgeTypeItem({ name: 'Pays', srcNode: node, dstNode: node, properties: [property] }),
        ]);
      else node.properties.push(property);
      const user = userEvent.setup();
      render(<Editor edge={edge} />);
      await user.click(screen.getByRole('button', { name: 'Edit node' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('decimalParametersInvalid');
    }
  );

  it.each([false, true])('preserves edited precision and scale across two saves with edge=%s', async (edge) => {
    const node = mocks.schema.nodeTypeList[0];
    const amount = new IProperty({
      name: 'amount',
      type: PropertyDataType.DECIMAL,
      decimalPrecision: 8,
      decimalScale: 2,
      nullable: false,
      default: '0M',
    });
    if (edge) {
      mocks.schema.updateEdgeTypeList([
        new IEdgeTypeItem({ name: 'Knows', srcNode: node, dstNode: node, properties: [amount] }),
      ]);
    } else {
      mocks.schema.originalNodeTypeList = [];
      node.properties.push(amount);
    }
    const user = userEvent.setup();
    render(<Editor edge={edge} />);

    for (const edit of [true, false]) {
      await user.click(screen.getByRole('button', { name: 'Edit node' }));
      const dialog = screen.getByRole('dialog');
      const moreButtons = within(dialog).getAllByRole('button', { name: /More|propertySettings/ });
      await user.click(moreButtons[moreButtons.length - 1]);
      // The mocked parent dialog is hidden by MUI's nested popover modal manager.
      const [precision, scale] = screen.getAllByRole('spinbutton', { hidden: true }) as HTMLInputElement[];
      if (edit) {
        await user.clear(precision);
        await user.type(precision, '12');
        await user.clear(scale);
        await user.type(scale, '3');
      } else {
        expect(precision.value).toBe('12');
        expect(scale.value).toBe('3');
      }
      await user.keyboard('{Escape}');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const current = {
        graphTypeName: 'people',
        nodeTypeList: mocks.schema.nodeTypeList.slice(),
        edgeTypeList: mocks.schema.edgeTypeList.slice(),
      };
      const original = {
        graphTypeName: 'people',
        nodeTypeList: mocks.schema.originalNodeTypeList,
        edgeTypeList: mocks.schema.originalEdgeTypeList,
      };
      const expected = '`amount` DECIMAL(12, 3) NOT NULL DEFAULT 0M';
      expect(generateCreateGraphTypeGQL(current)).toContain(expected);
      expect(generateAlterGraphTypeGQL(original, current)).toContain(expected);
    }
  });
});
