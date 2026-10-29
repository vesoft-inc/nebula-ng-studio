// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { themeStore } from '../../theme/index';
import { PropertyDataType } from '@vesoft-inc/studio-core/contracts';
import { FormContainer } from 'react-hook-form-mui';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem, IProperty } from '../../schema/types';
import NodeTypeConfigForm from './NodeType/NodeTypeConfigForm';
import EdgeTypeConfigForm from './EdgeType/EdgeTypeConfigForm';
import en from '../../locales/en_US/graphtype';
import zh from '../../locales/zh_CN/graphtype';
import { getEdgeTypeFormValues, getNodeTypeFormValues } from './formValues';

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

vi.mock('../context', () => ({
  useGraphTypeStore: () => store.graphtypeStore,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations = store.language === 'en' ? en : store.language === 'zh' ? zh : null;
      return (translations?.[key as keyof typeof en] || key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? '')
      );
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
    type === 'node'
      ? getNodeTypeFormValues(person)
      : getEdgeTypeFormValues(new IEdgeTypeItem({ name: 'knows', labels, srcNode: person, dstNode: person }));
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

  it('identifies the invalid property and reason while retaining general key help', async () => {
    const { user } = renderForm('node', [], vi.fn(), [
      new IProperty({ name: 'id', isPrimaryKey: true, nullable: true }),
    ]);
    expect(screen.getByRole('status').textContent).toBe('nodePrimaryKeyNullable');
    await user.hover(screen.getByRole('button', { name: 'primaryKey' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe('nodePrimaryKeyHelp');
  });

  describe.each(['en', 'zh'])('actionable %s key guidance', (language) => {
    const translations = language === 'en' ? en : zh;
    const interpolate = (text: string, values: Record<string, unknown>) =>
      text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name]));

    it.each([
      {
        name: '',
        reason: interpolate(translations.nodePrimaryKeyNameRequired, { index: 1 }),
      },
      { nullable: true, reason: interpolate(translations.nodePrimaryKeyNullable, { property: 'id' }) },
      { default: '0', reason: interpolate(translations.nodePrimaryKeyDefault, { property: 'id' }) },
      {
        type: PropertyDataType.LIST,
        reason: interpolate(translations.nodePrimaryKeyTypeUnsupported, { property: 'id', type: 'LIST' }),
      },
    ])('describes the property and reason in a complete sentence: $reason', ({ reason, ...property }) => {
      store.language = language;
      renderForm('node', [], vi.fn(), [new IProperty({ name: 'id', isPrimaryKey: true, ...property })]);
      expect(screen.getByRole('status').textContent).toBe(reason);
      expect(screen.getByRole('status').textContent).not.toMatch(/^id\s*[:：]/);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('status').textContent).not.toContain(translations.nodePrimaryKeyInvalid);
    });

    it('exposes only the remaining issues across composite key members on keyboard focus', async () => {
      store.language = language;
      renderForm('node', [], vi.fn(), [
        new IProperty({ name: 'id', isPrimaryKey: true, nullable: true, default: '0' }),
        new IProperty({ name: 'tenant', isPrimaryKey: true, type: PropertyDataType.LIST }),
        new IProperty({ name: 'ordinary', nullable: true, default: '0' }),
      ]);
      const more = screen.getByRole('button', {
        name: interpolate(translations.nodePrimaryKeyMoreIssues, { count: 2 }),
      });
      expect(more.textContent).toBe('(+2)');
      expect(more.getAttribute('type')).toBe('button');
      expect(getComputedStyle(more).flexShrink).toBe('0');
      expect(getComputedStyle(more.parentElement!).gap).toBe('4px');
      more.focus();
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).not.toContain(interpolate(translations.nodePrimaryKeyNullable, { property: 'id' }));
      expect(tooltip.textContent).toContain(interpolate(translations.nodePrimaryKeyDefault, { property: 'id' }));
      expect(tooltip.textContent).toContain(
        interpolate(translations.nodePrimaryKeyTypeUnsupported, { property: 'tenant', type: 'LIST' })
      );
      expect(tooltip.textContent).not.toContain(translations.nodePrimaryKeyNullableAction);
      expect(tooltip.textContent).toContain(translations.nodePrimaryKeyDefaultAction);
      expect(tooltip.textContent).toContain(translations.nodePrimaryKeyTypeUnsupportedAction);
      expect(tooltip.querySelectorAll('.MuiTypography-root')).toHaveLength(4);
      expect(tooltip.textContent).not.toContain('ordinary');
    });

    it('updates to the remaining reason and clears the hint when all settings are corrected', async () => {
      store.language = language;
      const { user } = renderForm('node', [], vi.fn(), [
        new IProperty({ name: 'id', isPrimaryKey: true, nullable: true, default: '0' }),
      ]);
      await user.click(
        screen.getByRole('button', { name: interpolate(translations.propertySettings, { property: 'id' }) })
      );
      await user.click(screen.getByRole('checkbox', { name: translations.nullable, hidden: true }));
      expect(screen.getByRole('status', { hidden: true }).textContent).toBe(
        interpolate(translations.nodePrimaryKeyDefault, { property: 'id' })
      );
      expect(
        screen.queryByRole('button', {
          name: interpolate(translations.nodePrimaryKeyMoreIssues, { count: 1 }),
          hidden: true,
        })
      ).toBeNull();
      await user.clear(screen.getByRole('textbox', { name: translations.defaultValue, hidden: true }));
      await waitFor(() => expect(screen.queryByRole('status', { hidden: true })).toBeNull());
      expect(
        screen.queryByRole('button', { name: /more primary key issues|还有 .*项主键问题/, hidden: true })
      ).toBeNull();
    });

    it('provides a clear fix for a single issue, not only multiple issues', async () => {
      store.language = language;
      const { user } = renderForm('node', [], vi.fn(), [
        new IProperty({ name: 'id', isPrimaryKey: true, nullable: true }),
      ]);
      expect(screen.queryByRole('button', { name: /more primary key issues|还有 .*项主键问题/ })).toBeNull();
      await user.hover(screen.getByRole('status'));
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toContain(translations.nodePrimaryKeyNullableAction);
      expect(tooltip.textContent).toContain(translations.nullable);
    });

    it('keeps a long property name identifiable without letting it expand the compact hint', async () => {
      store.language = language;
      const name = 'very_long_primary_key_property_name_'.repeat(4);
      const { user } = renderForm('node', [], vi.fn(), [new IProperty({ name, isPrimaryKey: true, nullable: true })]);
      const status = screen.getByRole('status');
      expect(status.textContent).toBe(interpolate(translations.nodePrimaryKeyNullable, { property: name }));
      expect(getComputedStyle(status).maxWidth).toBe('100%');
      expect(getComputedStyle(status).textOverflow).toBe('ellipsis');
      await user.hover(status);
      expect((await screen.findByRole('tooltip')).textContent).toContain(status.textContent);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('uses the row number in complete sentences when an unnamed key has multiple issues', async () => {
      store.language = language;
      renderForm('node', [], vi.fn(), [
        new IProperty({ name: '', isPrimaryKey: true, nullable: true, default: '0', type: PropertyDataType.LIST }),
      ]);
      const more = screen.getByRole('button', {
        name: interpolate(translations.nodePrimaryKeyMoreIssues, { count: 3 }),
      });
      expect(more.textContent).toBe('(+3)');
      more.focus();
      const tooltip = await screen.findByRole('tooltip');
      expect(screen.getByRole('status').textContent).toBe(
        interpolate(translations.nodePrimaryKeyNameRequired, { index: 1 })
      );
      expect(tooltip.textContent).not.toContain(interpolate(translations.nodePrimaryKeyNameRequired, { index: 1 }));
      expect(tooltip.textContent).not.toContain(translations.nodePrimaryKeyNameRequiredAction);
      for (const text of [
        translations.nodePrimaryKeyNullableUnnamed,
        translations.nodePrimaryKeyDefaultUnnamed,
        translations.nodePrimaryKeyTypeUnsupportedUnnamed,
      ]) {
        expect(tooltip.textContent).toContain(interpolate(text, { index: 1, type: 'LIST' }));
      }
      expect(tooltip.querySelectorAll('.MuiTypography-root')).toHaveLength(6);
      expect(tooltip.textContent).not.toContain('“”');
      expect(tooltip.textContent).not.toContain('""');
    });

    it('shows only the additional issue on hover over the remaining-issue count', async () => {
      store.language = language;
      const { user } = renderForm('node', [], vi.fn(), [
        new IProperty({ name: 'id', isPrimaryKey: true, nullable: true, default: '0' }),
      ]);
      const more = screen.getByRole('button', {
        name: interpolate(translations.nodePrimaryKeyMoreIssues, { count: 1 }),
      });
      expect(more.textContent).toBe('(+1)');
      await user.hover(more);
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).not.toContain(interpolate(translations.nodePrimaryKeyNullable, { property: 'id' }));
      expect(tooltip.textContent).not.toContain(translations.nodePrimaryKeyNullableAction);
      expect(tooltip.textContent).toContain(interpolate(translations.nodePrimaryKeyDefault, { property: 'id' }));
      expect(tooltip.textContent).toContain(translations.nodePrimaryKeyDefaultAction);
      expect(tooltip.querySelectorAll('.MuiTypography-root')).toHaveLength(2);
      expect(screen.queryByText('View details')).toBeNull();
      expect(screen.queryByText('查看详情')).toBeNull();
    });
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
