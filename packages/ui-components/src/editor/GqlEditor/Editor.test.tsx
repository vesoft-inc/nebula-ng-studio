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
  const { useEffect } = await import('react');
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
    default: function MockMonacoEditor({ onMount }: any) {
      useEffect(() => {
        const model = {
          getWordUntilPosition: () => ({ startColumn: 5, endColumn: 5 }),
          getLineContent: () => 'USE ',
          getLineCount: () => 1,
        };
        const actions = new Map();
        const instance = {
          getModel: () => model,
          getContentHeight: () => 20,
          getOption: () => 18,
          addAction: (action: any) => {
            actions.set(action.id, action);
            return { dispose: () => actions.delete(action.id) };
          },
          onDidContentSizeChange: () => ({ dispose: vi.fn() }),
          updateOptions: vi.fn(),
          actions,
        };
        registry.editors.push(instance);
        onMount(instance, monaco);
      }, []);
      return <div />;
    },
  };
});

afterEach(() => {
  cleanup();
  registry.editors.length = 0;
  expect(registry.completion.size).toBe(0);
  expect(registry.inline.size).toBe(0);
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
