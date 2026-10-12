// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { FormContainer } from 'react-hook-form-mui';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem } from '@studio/interfaces';
import NodeTypeConfigForm from './NodeType/NodeTypeConfigForm';
import EdgeTypeConfigForm from './EdgeType/EdgeTypeConfigForm';

const store = vi.hoisted(() => ({
  graphtypeStore: {
    mode: 'create',
    schemaStore: {
      nodeTypeLabeMap: new Map([['Person', ['person']]]),
      edgeTypeLabelMap: new Map([['Person', ['knows']]]),
      nodeTypeList: [] as INodeTypeItem[],
    },
  },
}));

vi.mock('@studio/stores', () => ({ useStore: () => store }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@vesoft-inc/icons', () => ({
  CloseFilled: () => null,
  AddFilled: () => null,
  MoreVertFilled: () => null,
  HelpCircleOutline: () => null,
  EyeOff: () => null,
  RemoveRedeyeFilled: () => null,
}));

const renderForm = (type: 'node' | 'edge', labels: string[] = [], onChange = vi.fn()) => {
  const person = new INodeTypeItem({ name: 'person', labels });
  store.graphtypeStore.schemaStore.nodeTypeList = [person];
  const values =
    type === 'node' ? person : new IEdgeTypeItem({ name: 'knows', labels, srcNode: person, dstNode: person });
  const onSubmit = vi.fn();

  render(
    <ThemeProvider theme={themeStore.theme}>
      <FormContainer defaultValues={values} onSuccess={onSubmit}>
        {type === 'node' ? <NodeTypeConfigForm onChange={onChange} /> : <EdgeTypeConfigForm onChange={onChange} />}
        <button type="submit">Save</button>
      </FormContainer>
    </ThemeProvider>
  );

  return { user: userEvent.setup(), input: screen.getByRole('combobox', { name: 'label' }), onSubmit, onChange };
};

afterEach(cleanup);
beforeEach(() => {
  store.graphtypeStore.mode = GraphTypeBuildMode.Create;
});

describe.each(['node', 'edge'] as const)('%s type label input', (type) => {
  it('commits a typed label on blur without selecting a dropdown option', async () => {
    const { user, input, onChange } = renderForm(type);

    await user.type(input, 'Employee');
    await user.tab();

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ labels: ['Employee'] })));
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Employee', { selector: '.MuiChip-label' })).toBeDefined();
  });

  it('includes the pending label when Save is clicked directly', async () => {
    const { user, input, onSubmit } = renderForm(type, ['Existing']);

    await user.type(input, 'Employee');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ labels: ['Existing', 'Employee'] }),
        expect.anything()
      )
    );
  });

  it('still supports committing a label with Enter', async () => {
    const { user, input, onChange, onSubmit } = renderForm(type);

    await user.type(input, 'Employee{Enter}');

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ labels: ['Employee'] })));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('still supports selecting an existing label', async () => {
    const { user, input, onChange } = renderForm(type);

    await user.type(input, 'Per');
    await user.click(screen.getByRole('option', { name: 'Person' }));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ labels: ['Person'] })));
  });

  it('does not duplicate a selected label when the same label is typed again', async () => {
    const { user, input, onChange } = renderForm(type, ['Employee']);

    await user.type(input, 'Employee');
    await user.tab();

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ labels: ['Employee'] })));
    expect(screen.getAllByText('Employee', { selector: '.MuiChip-label' })).toHaveLength(1);
  });

  it('does not add a label when an empty input loses focus', async () => {
    const { user, input, onSubmit } = renderForm(type);

    await user.click(input);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ labels: [] }), expect.anything())
    );
  });

  it('keeps labels disabled in readonly mode', () => {
    store.graphtypeStore.mode = GraphTypeBuildMode.Readonly;
    const { input } = renderForm(type, ['Person']);

    expect((input as HTMLInputElement).disabled).toBe(true);
  });
});
