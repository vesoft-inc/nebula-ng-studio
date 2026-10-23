// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { editor } from 'monaco-editor';
import GqlEditor from './Editor';

const registry = vi.hoisted(() => ({
  completion: new Set<any>(),
  inline: new Set<any>(),
  editors: [] as any[],
  t: (key: string) => key,
}));
vi.mock('@mui/material/styles', () => ({ useTheme: () => ({ palette: { mode: 'light' } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: registry.t }) }));
vi.mock('../MonacoEditor', async () => {
  const { useEffect, useRef } = await import('react');
  const register = (set: Set<any>, provider: any) => {
    set.add(provider);
    return { dispose: () => set.delete(provider) };
  };
  const monaco = {
    languages: {
      getLanguages: () => [],
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      IndentAction: { IndentOutdent: 2 },
      CompletionItemKind: { Keyword: 1, Function: 2, Text: 3 },
      registerCompletionItemProvider: (_id: string, provider: any) => register(registry.completion, provider),
      registerInlineCompletionsProvider: (_id: string, provider: any) => register(registry.inline, provider),
    },
    Range: class {},
    KeyMod: { Shift: 1 },
    KeyCode: { Enter: 2 },
    editor: { EditorOption: { lineHeight: 1 } },
  };
  return {
    default: function MockMonacoEditor({ onMount, value, height, className }: any) {
      const currentValue = useRef(value);
      currentValue.current = value;
      useEffect(() => {
        const model = {
          getWordUntilPosition: () => ({ startColumn: 5, endColumn: 5 }),
          getLineContent: () => 'USE ',
          getLineCount: () => (currentValue.current ?? '').split('\n').length,
        };
        const actions = new Map();
        const contentSizeListeners = new Set<() => void>();
        const instance = {
          getModel: () => model,
          // Monaco includes its 4px top and bottom padding in content height.
          getContentHeight: vi.fn(() => model.getLineCount() * 18 + 8),
          getOption: () => 18,
          addAction: (action: any) => {
            actions.set(action.id, action);
            return { dispose: () => actions.delete(action.id) };
          },
          onDidContentSizeChange: (listener: () => void) => register(contentSizeListeners, listener),
          updateOptions: vi.fn(),
          actions,
          contentSizeListeners,
        };
        registry.editors.push(instance);
        onMount(instance, monaco);
      }, []);
      return <div data-testid="editor" className={className} style={{ height: height ?? '100%' }} />;
    },
  };
});

afterEach(() => {
  cleanup();
  registry.editors.length = 0;
  expect(registry.completion.size).toBe(0);
  expect(registry.inline.size).toBe(0);
});

describe('GqlEditor sizing', () => {
  it.each([
    ['empty', '', 34],
    ['single-line', 'RETURN 1', 34],
    ['multi-line', 'MATCH (v)\nRETURN v\nLIMIT 10', 62],
  ])('sizes %s content with only the wrapper inset added', (_label, value, height) => {
    const view = render(<GqlEditor value={value} autoHeight />);
    const element = view.getByTestId('editor');
    expect(element.style.height).toBe(`${height}px`);
    expect(getComputedStyle(element).boxSizing).toBe('border-box');
    expect(getComputedStyle(element).minHeight).toBe('40px');
    expect(getComputedStyle(element).maxHeight).toBe('400px');
  });

  it('follows word wrapping and width changes without changing the model row count', () => {
    const onRowCountChange = vi.fn();
    const view = render(<GqlEditor value={'RETURN '.repeat(40)} autoHeight onRowCountChange={onRowCountChange} />);
    const instance = registry.editors[0];
    const resizeContent = (height: number) => {
      act(() => {
        instance.getContentHeight.mockReturnValue(height);
        instance.contentSizeListeners.forEach((listener: () => void) => listener());
      });
    };

    resizeContent(98);
    expect(view.getByTestId('editor').style.height).toBe('106px');
    resizeContent(44);
    expect(view.getByTestId('editor').style.height).toBe('52px');
    expect(getComputedStyle(view.getByTestId('editor')).paddingTop).toBe('8px');
    expect(onRowCountChange).toHaveBeenLastCalledWith(1);
  });

  it('keeps the height cap for long queries and shrinks when the query is cleared', () => {
    const view = render(<GqlEditor value={Array(40).fill('RETURN 1').join('\n')} autoHeight maxHeight="180px" />);
    const element = view.getByTestId('editor');
    expect(element.style.height).toBe('728px');
    expect(getComputedStyle(element).maxHeight).toBe('180px');

    view.rerender(<GqlEditor value="" autoHeight maxHeight="180px" />);
    act(() => registry.editors[0].contentSizeListeners.forEach((listener: () => void) => listener()));
    expect(element.style.height).toBe('34px');
    expect(getComputedStyle(element).minHeight).toBe('40px');
  });

  it.each([240, '60%', undefined])('preserves the fixed height %s when autoHeight is disabled', (height) => {
    const view = render(<GqlEditor value="RETURN 1" height={height} />);
    act(() => {
      registry.editors[0].getContentHeight.mockReturnValue(728);
      registry.editors[0].contentSizeListeners.forEach((listener: () => void) => listener());
    });
    const element = view.getByTestId('editor');
    expect(element.style.height).toBe(typeof height === 'number' ? `${height}px` : (height ?? '100%'));
    expect(element.className).toBe('');
  });
});

describe('GqlEditor instance isolation', () => {
  it('submits only the active editor and completes only that model using current props', () => {
    const submitA = vi.fn();
    const submitB = vi.fn();
    let editorA: editor.IStandaloneCodeEditor | undefined;
    let editorB: editor.IStandaloneCodeEditor | undefined;
    const a = render(
      <StrictMode>
        <GqlEditor
          value="USE "
          graphNames={['graph-a']}
          onSubmit={submitA}
          onReady={(value) => {
            editorA = value;
          }}
        />
      </StrictMode>
    );
    render(
      <StrictMode>
        <GqlEditor
          value="USE "
          graphNames={['graph-b']}
          onSubmit={submitB}
          onReady={(value) => {
            editorB = value;
          }}
        />
      </StrictMode>
    );
    expect(registry.completion.size).toBe(2);
    const activeA = registry.editors.find((item) => item === editorA);
    act(() => activeA.actions.get('submit-gql').run());
    expect(submitA).toHaveBeenCalledOnce();
    expect(submitB).not.toHaveBeenCalled();
    const suggestions = () =>
      [...registry.completion]
        .flatMap(
          (provider) => provider.provideCompletionItems(editorA!.getModel(), { lineNumber: 1, column: 5 }).suggestions
        )
        .filter((item) => item.detail === 'Graph')
        .map((item) => item.label);
    expect(suggestions()).toEqual(['graph-a']);
    a.rerender(
      <StrictMode>
        <GqlEditor value="USE " graphNames={['updated-a']} readOnly onSubmit={submitA} />
      </StrictMode>
    );
    expect(suggestions()).toEqual(['updated-a']);
    act(() => activeA.actions.get('submit-gql').run());
    expect(submitA).toHaveBeenCalledOnce();
    a.unmount();
    expect(registry.completion.size).toBe(1);
    expect(activeA.actions.size).toBe(0);
    expect(
      [...registry.completion][0]
        .provideCompletionItems(editorB!.getModel(), { lineNumber: 1, column: 5 })
        .suggestions.some((item: any) => item.label === 'graph-b')
    ).toBe(true);
  });
});
