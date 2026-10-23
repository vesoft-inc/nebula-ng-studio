// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { themeStore } from '../../theme/index';
import { MemoryRouter } from 'react-router-dom';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem, IProperty } from '../../schema/types';
import { PropertyDataType } from '@vesoft-inc/utils';
import { StrictMode } from 'react';
import { generateCreateGraphTypeGQL } from './VisualBuilder/util';
import GraphTypeBuilder from './index';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  execGql: vi.fn(),
  createSketch: vi.fn(),
  toPng: vi.fn(),
  migrate: vi.fn(),
  setActiveItem: vi.fn(),
  message: { success: vi.fn(), error: vi.fn() },
  schema: {
    graphtypeName: 'people',
    nodeTypeList: [] as INodeTypeItem[],
    edgeTypeList: [] as IEdgeTypeItem[],
    originalNodeTypeList: [] as INodeTypeItem[],
    originalEdgeTypeList: [] as IEdgeTypeItem[],
    transformGraphTypeToEditorFromDDL: vi.fn(),
    transformGrapTypeBySketch: vi.fn(),
  },
  updateGraphTypesBySchema: vi.fn(),
}));
vi.mock('../context', () => {
  const store = {
    services: { execute: mocks.execGql, layouts: { migrate: mocks.migrate }, sketches: { create: mocks.createSketch } },
    schemaStore: mocks.schema,
    canvasStore: {
      setActiveItem: mocks.setActiveItem,
      getCanvasLayout: () => ({ Person: { x: 10, y: 20 } }),
      instance: { getNodes: () => [{ id: 'n', position: { x: 10, y: 20 } }], getEdges: () => [] },
    },
    updateMode: vi.fn(),
    initSchemaStore: vi.fn(),
    destroySchemaStore: vi.fn(),
  };
  return { useGraphTypeStore: () => store };
});
vi.mock('../../shared/useModal', () => ({
  useModal: () => ({ message: mocks.message }),
}));
vi.mock('../../shared/utilities', () => ({
  encodeUrl: encodeURIComponent,
  isEqualIgnoringFields: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b),
  getVesoftBorder: () => 'none',
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@vesoft-inc/icons', () => ({ CloseFilled: () => null, EditFilled: () => null }));
vi.mock('dom-to-image', () => ({ default: { toPng: mocks.toPng } }));
vi.mock('../../shared/index', () => ({ BreadCrumbs: () => null }));
vi.mock('../../shared/TitleEllipsis', () => ({ default: () => null }));
vi.mock('../../shared/SegmentButton/index', () => ({
  default: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
vi.mock('./VisualBuilder/index', async () => {
  const { useEffect } = await import('react');
  return {
    default: function MockVisualBuilder() {
      // The real builder resets its selection when it mounts.
      useEffect(() => {
        mocks.setActiveItem(null);
        return () => mocks.setActiveItem(null);
      }, []);
      return <div className="react-flow__viewport">Draft canvas</div>;
    },
  };
});
vi.mock('./VisualBuilder/MassiveGraphConfirmMask', () => ({
  MassiveGraphConfirmMask: () => <div>Heavy graph confirmation</div>,
}));
vi.mock('./NodeType/index', () => ({ default: () => <div>Node table</div> }));
vi.mock('./EdgeType/index', () => ({ default: () => <div>Edge table</div> }));
vi.mock('./LabelTable/index', () => ({ default: () => null }));
vi.mock('./Preview', () => ({ default: ({ ngql }: { ngql: string }) => <pre data-testid="preview">{ngql}</pre> }));

const person = (withKey = true) =>
  new INodeTypeItem({
    name: 'Person',
    labels: ['PersonLabel'],
    properties: [new IProperty({ name: 'id', isPrimaryKey: withKey })],
  });
const renderBuilder = (mode = GraphTypeBuildMode.Create, strictMode = false) => {
  const path = `/schema-manager/graphtype/${mode === GraphTypeBuildMode.Edit ? 'edit/people' : 'create'}`;
  const builder = (
    <ThemeProvider theme={themeStore.theme}>
      <MemoryRouter initialEntries={[path]}>
        <GraphTypeBuilder
          mode={mode}
          graphTypeName="people"
          onSaved={() => mocks.navigate('/schema-manager/graphtype')}
        />
      </MemoryRouter>
    </ThemeProvider>
  );
  const result = render(strictMode ? <StrictMode>{builder}</StrictMode> : builder);
  return { ...result, user: userEvent.setup() };
};
const preview = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'preview' }));
  await screen.findByTestId('preview');
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.schema.graphtypeName = 'people';
  mocks.schema.nodeTypeList = [person()];
  mocks.schema.originalNodeTypeList = [];
  mocks.schema.edgeTypeList = [];
  mocks.schema.originalEdgeTypeList = [];
  mocks.execGql.mockResolvedValue({ code: 0 });
  mocks.migrate.mockResolvedValue(undefined);
});

describe('graph type validation and submission', () => {
  it.each([GraphTypeBuildMode.Create, GraphTypeBuildMode.Edit, GraphTypeBuildMode.Sketch])(
    'blocks invalid DECIMAL from node or edge drafts before preview in %s',
    async (mode) => {
      const amount = new IProperty({ name: 'amount', type: PropertyDataType.DECIMAL, decimalPrecision: 257 });
      const edge = new IEdgeTypeItem({
        name: 'Pays',
        srcNode: mocks.schema.nodeTypeList[0],
        dstNode: mocks.schema.nodeTypeList[0],
        properties: [amount],
      });
      mocks.schema.edgeTypeList = [edge];
      const { user } = renderBuilder(mode);
      await user.click(screen.getByRole('button', { name: 'preview' }));
      await waitFor(() => expect(mocks.setActiveItem).toHaveBeenCalledWith({ type: 'edge', value: edge }));
      expect(screen.queryByTestId('preview')).toBeNull();
      expect(mocks.execGql).not.toHaveBeenCalled();
    }
  );

  it('rechecks DECIMAL before submission after a draft changed behind preview', async () => {
    const node = mocks.schema.nodeTypeList[0];
    node.properties.push(
      new IProperty({ name: 'amount', type: PropertyDataType.DECIMAL, decimalPrecision: 256, decimalScale: 128 })
    );
    const { user } = renderBuilder();
    await preview(user);
    node.properties[1].decimalScale = 129;
    await user.click(screen.getByRole('button', { name: 'createGraphType' }));
    await waitFor(() => expect(mocks.setActiveItem).toHaveBeenCalledWith({ type: 'tag', value: node }));
    expect(mocks.execGql).not.toHaveBeenCalled();
  });

  it('shows incomplete-draft guidance on the sketch action rather than in the editor', async () => {
    const { user } = renderBuilder();
    expect(screen.queryByRole('tooltip')).toBeNull();
    await user.hover(screen.getByRole('button', { name: 'saveAsSketch' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe('saveAsSketchHelp');
    expect(mocks.createSketch).not.toHaveBeenCalled();
    expect(mocks.execGql).not.toHaveBeenCalled();
  });

  it.each([GraphTypeBuildMode.Create, GraphTypeBuildMode.Sketch])(
    'blocks no-key preview in %s and opens the node without a duplicate alert',
    async (mode) => {
      const node = person(false);
      mocks.schema.nodeTypeList = [node];
      const { user } = renderBuilder(mode);
      await user.click(screen.getByRole('button', { name: 'preview' }));
      await waitFor(() =>
        expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: node }))
      );
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByTestId('preview')).toBeNull();
      expect(mocks.execGql).not.toHaveBeenCalled();
    }
  );

  it('opens an invalid ADD NODE candidate while leaving valid existing nodes alone', async () => {
    const existing = person();
    const added = new INodeTypeItem({ name: 'Project' });
    mocks.schema.originalNodeTypeList = [existing];
    mocks.schema.nodeTypeList = [existing, added];
    const { user } = renderBuilder(GraphTypeBuildMode.Edit);
    await user.click(screen.getByRole('button', { name: 'preview' }));
    await waitFor(() =>
      expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: added }))
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('preview')).toBeNull();
    expect(mocks.execGql).not.toHaveBeenCalled();
  });

  it.each(['nodeType', 'edgeType', 'label'])('returns from the %s table to the invalid node editor', async (tab) => {
    const node = person(false);
    mocks.schema.nodeTypeList = [node];
    const { user } = renderBuilder();
    await user.click(screen.getByRole('button', { name: tab }));
    expect(screen.queryByRole('button', { name: 'saveAsSketch' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'preview' }));
    await waitFor(() => expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: node })));
    expect(screen.getByRole('button', { name: 'saveAsSketch' })).toBeDefined();
    expect(screen.queryByText('Node table')).toBeNull();
    expect(screen.queryByText('Edge table')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reopens the first invalid node and advances to the next unresolved node after correction', async () => {
    const first = person(false);
    const second = new INodeTypeItem({
      name: 'Project',
      properties: [new IProperty({ name: 'id', isPrimaryKey: true, nullable: true })],
    });
    mocks.schema.nodeTypeList = [first, second];
    const { user } = renderBuilder();
    await user.click(screen.getByRole('button', { name: 'preview' }));
    await waitFor(() =>
      expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: first }))
    );
    mocks.setActiveItem(null);
    await user.click(screen.getByRole('button', { name: 'preview' }));
    await waitFor(() =>
      expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: first }))
    );
    first.properties[0].isPrimaryKey = true;
    await user.click(screen.getByRole('button', { name: 'preview' }));
    await waitFor(() =>
      expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: second }))
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('preview')).toBeNull();
    second.properties[0].nullable = false;
    await preview(user);
    expect(screen.getByTestId('preview').textContent).toContain('PRIMARY KEY(`id`)');
    expect(mocks.execGql).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'opens the invalid node after mounting a masked large builder (StrictMode=%s)',
    async (strictMode) => {
      const node = person(false);
      mocks.schema.nodeTypeList = [node, ...Array.from({ length: 4999 }, () => person())];
      const { user } = renderBuilder(GraphTypeBuildMode.Create, strictMode);
      expect(screen.getByText('Heavy graph confirmation')).toBeDefined();
      await user.click(screen.getByRole('button', { name: 'preview' }));
      await waitFor(() =>
        expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: node }))
      );
      expect(screen.queryByText('Heavy graph confirmation')).toBeNull();
      expect(screen.getByText('Draft canvas')).toBeDefined();
      expect(screen.queryByRole('alert')).toBeNull();
    }
  );

  it('submits a valid new node alongside valid existing node keys', async () => {
    const existing = person();
    const added = new INodeTypeItem({
      name: 'Project',
      properties: [new IProperty({ name: 'id', isPrimaryKey: true })],
    });
    mocks.schema.originalNodeTypeList = [existing];
    mocks.schema.nodeTypeList = [existing, added];
    const { user } = renderBuilder(GraphTypeBuildMode.Edit);
    await preview(user);
    await user.click(screen.getByRole('button', { name: 'commitEdit' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.execGql).toHaveBeenCalledWith(expect.stringContaining('ADD NODE `Project`'), { errTip: false });
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it('blocks preview after the only key on an existing node is unchecked', async () => {
    const original = person();
    const current = new INodeTypeItem(original);
    current.properties[0].isPrimaryKey = false;
    mocks.schema.originalNodeTypeList = [original];
    mocks.schema.nodeTypeList = [current];
    const { user } = renderBuilder(GraphTypeBuildMode.Edit);
    await user.click(screen.getByRole('button', { name: 'preview' }));
    await waitFor(() =>
      expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: current }))
    );
    expect(screen.queryByTestId('preview')).toBeNull();
    expect(mocks.execGql).not.toHaveBeenCalled();
  });

  it('blocks final edit submission if the existing key changes after preview', async () => {
    const original = person();
    const current = new INodeTypeItem(original);
    current.properties.push(new IProperty({ name: 'email' }));
    mocks.schema.originalNodeTypeList = [original];
    mocks.schema.nodeTypeList = [current];
    const { user } = renderBuilder(GraphTypeBuildMode.Edit);
    await preview(user);
    expect(screen.getByTestId('preview').textContent).toContain('ADD PROPERTIES {`email` STRING}');
    current.properties[0].isPrimaryKey = false;
    await user.click(screen.getByRole('button', { name: 'commitEdit' }));
    await waitFor(() =>
      expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: current }))
    );
    expect(screen.queryByTestId('preview')).toBeNull();
    expect(mocks.execGql).not.toHaveBeenCalled();
  });

  it('does not execute a conflicting delete and re-create despite a valid primary key', async () => {
    mocks.schema.originalNodeTypeList = [person()];
    const { user } = renderBuilder(GraphTypeBuildMode.Edit);
    await preview(user);
    await user.click(screen.getByRole('button', { name: 'commitEdit' }));
    expect((await screen.findByRole('alert')).textContent).toContain('nameConflictError');
    expect(mocks.execGql).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('keeps the graph-name input focused while typing and preserves the complete name', async () => {
    const { user } = renderBuilder();
    const input = screen.getByRole('textbox', { name: /graphTypeName/ });
    await user.clear(input);
    await user.type(input, 'qa_composite');
    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe('qa_composite');
    await preview(user);
    expect(screen.getByTestId('preview').textContent).toContain('CREATE GRAPH TYPE `qa_composite`');
  });

  it('saves an incomplete no-key sketch without attempting DDL execution', async () => {
    mocks.schema.nodeTypeList = [person(false)];
    mocks.toPng.mockResolvedValue('data:image/png;base64,canvas');
    mocks.createSketch.mockResolvedValue({ code: 0 });
    vi.stubGlobal(
      'Image',
      class {
        width = 100;
        height = 100;
        onload?: () => void;
        set src(_value: string) {
          this.onload?.();
        }
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,thumbnail');
    const { user } = renderBuilder();
    await user.click(screen.getByRole('button', { name: 'saveAsSketch' }));
    await waitFor(() =>
      expect(mocks.createSketch).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'people',
          snapshot: 'data:image/png;base64,thumbnail',
        })
      )
    );
    const saved = JSON.parse(mocks.createSketch.mock.calls[0][0].schema);
    expect(saved.nodes[0].properties[0].isPrimaryKey).toBe(false);
    expect(mocks.execGql).not.toHaveBeenCalled();
    expect(mocks.message.success).toHaveBeenCalledWith('sketchSaveSuccess');
  });

  it('submits multiple selected properties as one composite primary key', async () => {
    const node = person();
    node.properties.push(new IProperty({ name: 'tenant', isPrimaryKey: true }));
    mocks.schema.nodeTypeList = [node];
    const { user } = renderBuilder();
    await preview(user);
    await user.click(screen.getByRole('button', { name: 'createGraphType' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.execGql).toHaveBeenCalledWith(expect.stringContaining('PRIMARY KEY(`id`,`tenant`)'), {
      errTip: false,
    });
  });

  it('revalidates at commit even if state changed after preview', async () => {
    const { user } = renderBuilder();
    await preview(user);
    const node = person(false);
    mocks.schema.nodeTypeList = [node];
    await user.click(screen.getByRole('button', { name: 'createGraphType' }));
    await waitFor(() => expect(mocks.setActiveItem).toHaveBeenLastCalledWith(expect.objectContaining({ value: node })));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('preview')).toBeNull();
    expect(screen.getByRole('button', { name: 'preview' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'saveAsSketch' })).toBeDefined();
    expect(mocks.execGql).not.toHaveBeenCalled();
  });

  it('keeps server errors and the DDL visible and allows retry', async () => {
    mocks.execGql.mockResolvedValueOnce({ code: 50004000, message: 'ErrInternalServer::[NT002]: Server rejected DDL' });
    const { user } = renderBuilder();
    await preview(user);
    const ddl = screen.getByTestId('preview').textContent;
    await user.click(screen.getByRole('button', { name: 'createGraphType' }));
    expect((await screen.findByRole('alert')).textContent).toContain('[50004000] [NT002]: Server rejected DDL');
    expect(screen.getByTestId('preview').textContent).toBe(ddl);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.migrate).not.toHaveBeenCalled();
    expect(mocks.message.error).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'createGraphType' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/schema-manager/graphtype'));
    expect(mocks.execGql).toHaveBeenCalledWith(expect.stringContaining('PersonLabel'), { errTip: false });
  });

  it.each([new Error('Network Error'), undefined, { code: 50004000 }])(
    'handles rejected or malformed responses: %j',
    async (error) => {
      if (error instanceof Error) mocks.execGql.mockRejectedValueOnce(error);
      else mocks.execGql.mockResolvedValueOnce(error);
      const { user } = renderBuilder();
      await preview(user);
      await user.click(screen.getByRole('button', { name: 'createGraphType' }));
      expect(await screen.findByRole('alert')).toBeDefined();
      expect(screen.getByTestId('preview')).toBeDefined();
      expect(mocks.navigate).not.toHaveBeenCalled();
    }
  );

  it('allows one in-flight request and re-enables submission after failure', async () => {
    let resolve!: (value: unknown) => void;
    mocks.execGql.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const { user } = renderBuilder();
    await preview(user);
    const button = screen.getByRole('button', { name: 'createGraphType' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
    expect(mocks.execGql).toHaveBeenCalledTimes(1);
    resolve({ code: 50004000, message: 'Failed' });
    await screen.findByRole('alert');
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  });

  it('does not navigate after a request settles on an unmounted page', async () => {
    let resolve!: (value: unknown) => void;
    mocks.execGql.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const { user, unmount } = renderBuilder();
    await preview(user);
    await user.click(screen.getByRole('button', { name: 'createGraphType' }));
    unmount();
    resolve({ code: 0 });
    await Promise.resolve();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it('permits a graph-type rename without validating unrelated ADD NODE drafts', async () => {
    mocks.schema.originalNodeTypeList = [person()];
    mocks.schema.nodeTypeList = [person(false)];
    const { user } = renderBuilder(GraphTypeBuildMode.Edit);
    const input = screen.getByRole('textbox', { name: /graphTypeName/ });
    await user.clear(input);
    await user.type(input, 'renamed');
    await preview(user);
    await user.click(screen.getByRole('button', { name: 'commitEdit' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.execGql).toHaveBeenCalledWith('RENAME GRAPH TYPE `people` TO `renamed`\n', { errTip: false });
    expect(mocks.migrate).toHaveBeenCalled();
  });

  it('preserves the original layout identity when a graph-type rename fails', async () => {
    mocks.schema.originalNodeTypeList = mocks.schema.nodeTypeList.slice();
    mocks.execGql.mockResolvedValueOnce({ code: 50004000, message: 'Rename rejected' });
    const { user } = renderBuilder(GraphTypeBuildMode.Edit);
    const input = screen.getByRole('textbox', { name: /graphTypeName/ });
    await user.clear(input);
    await user.type(input, 'renamed');
    await preview(user);
    await user.click(screen.getByRole('button', { name: 'commitEdit' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Rename rejected');
    expect(mocks.migrate).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('preview').textContent).toContain('RENAME GRAPH TYPE `people` TO `renamed`');
  });

  it('retains the syntactic guard without treating no-key DDL as executable', () => {
    const gql = generateCreateGraphTypeGQL({
      graphTypeName: 'people',
      nodeTypeList: [person(false)],
      edgeTypeList: [],
    });
    expect(gql).not.toContain('PRIMARY KEY()');
  });
});
