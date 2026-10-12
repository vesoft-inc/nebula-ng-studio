// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { FormContainer } from 'react-hook-form-mui';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem, IProperty } from '@studio/interfaces';
import NodeTypeConfigForm from './NodeType/NodeTypeConfigForm';
import EdgeTypeConfigForm from './EdgeType/EdgeTypeConfigForm';
import en from '@studio/utils/i18n/en_US/graphtype';
import zh from '@studio/utils/i18n/zh_CN/graphtype';

const store = vi.hoisted(() => ({
  language: 'keys',
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
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations = store.language === 'en' ? en : store.language === 'zh' ? zh : null;
      return translations?.[key as keyof typeof en] || key;
    },
  }),
}));
vi.mock('@vesoft-inc/icons', () => ({
  CloseFilled: () => null,
  AddFilled: () => null,
  MoreVertFilled: () => null,
  HelpCircleOutline: () => null,
  EyeOff: () => null,
  RemoveRedeyeFilled: () => null,
}));

const renderForm = (type: 'node' | 'edge', labels: string[] = [], onChange = vi.fn(), properties: IProperty[] = []) => {
  const person = new INodeTypeItem({ name: 'person', labels, properties });
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

  const label = store.language === 'en' ? en.label : store.language === 'zh' ? zh.label : 'label';
  return { user: userEvent.setup(), input: screen.getByRole('combobox', { name: label }), onSubmit, onChange };
};

afterEach(cleanup);
beforeEach(() => {
  store.language = 'keys';
  store.graphtypeStore.mode = GraphTypeBuildMode.Create;
});

describe('node primary key guidance', () => {
  it('warns about a missing key without blocking draft form submission', async () => {
    const { user, onSubmit } = renderForm('node', [], vi.fn(), [new IProperty({ name: 'id' })]);
    expect(screen.getByRole('status').textContent).toContain('nodePrimaryKeyRequired');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('clears the warning when a key is selected without silently selecting it', async () => {
    const { user } = renderForm('node', [], vi.fn(), [new IProperty({ name: 'id' })]);
    const key = screen.getByRole('checkbox', { name: 'primaryKey: id' }) as HTMLInputElement;
    expect(key.checked).toBe(false);
    await user.click(key);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(key.checked).toBe(true);
  });

  it('does not show editable-key guidance in readonly mode', () => {
    store.graphtypeStore.mode = GraphTypeBuildMode.Readonly;
    renderForm('node', [], vi.fn(), [new IProperty({ name: 'id' })]);
    expect(screen.queryByRole('status')).toBeNull();
    expect((screen.getByRole('checkbox', { name: 'primaryKey: id' }) as HTMLInputElement).disabled).toBe(true);
  });

  it.each(['en', 'zh'])('keeps the %s guidance short and inline instead of adding an Alert block', (language) => {
    store.language = language;
    const translations = language === 'en' ? en : zh;
    renderForm('node', [], vi.fn(), [new IProperty({ name: 'id' })]);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe(translations.nodePrimaryKeyRequired);
    expect(status.textContent!.length).toBeLessThan(50);
    expect(status.parentElement).toBe(screen.getByText(translations.properties).parentElement);
    expect(getComputedStyle(status.parentElement!).display).toBe('flex');
    expect(getComputedStyle(status.parentElement!).flexWrap).toBe('wrap');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.body.textContent).not.toContain(translations.nodePrimaryKeyHelp);
    expect(document.body.textContent).not.toContain(translations.saveAsSketchHelp);
  });

  it.each(['en', 'zh'])(
    'makes the %s detailed key rules available to keyboard users without submitting',
    async (language) => {
      store.language = language;
      const translations = language === 'en' ? en : zh;
      const { onSubmit } = renderForm('node', [], vi.fn(), [new IProperty({ name: 'id' })]);
      const help = screen.getByRole('button', { name: translations.primaryKey });
      help.focus();
      expect((await screen.findByRole('tooltip')).textContent).toBe(translations.nodePrimaryKeyHelp);
      expect(help.getAttribute('type')).toBe('button');
      expect(onSubmit).not.toHaveBeenCalled();
    }
  );

  it('keeps invalid-key guidance compact while exposing the constraints in help', async () => {
    const { user } = renderForm('node', [], vi.fn(), [
      new IProperty({ name: 'id', isPrimaryKey: true, nullable: true }),
    ]);
    expect(screen.getByRole('status').textContent).toBe('nodePrimaryKeyInvalid');
    await user.hover(screen.getByRole('button', { name: 'primaryKey' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe('nodePrimaryKeyHelp');
  });
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
