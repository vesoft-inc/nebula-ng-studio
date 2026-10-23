import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { css } from '@emotion/css';
import MonacoEditor, { type MonacoEditorProps } from '../MonacoEditor';
import type { IDisposable } from 'monaco-editor';
import { GQL_LANG_ID } from '../constants';
import { GQL_KEYWORDS, GQL_PROCEDURES } from '../keywords';
import { GQL_HIGHLIGHT_CONFIG } from '../highlight';
import type { GqlEditorProps } from '../types';

const registeredLanguages = new WeakSet<object>();

export default function GqlEditor(props: GqlEditorProps) {
  const theme = useTheme();
  const { t } = useTranslation('console');
  const latest = useRef(props);
  latest.current = props;
  const [instance, setInstance] = useState<{
    editor: Parameters<NonNullable<MonacoEditorProps['onMount']>>[0];
    monaco: NonNullable<Parameters<NonNullable<MonacoEditorProps['onMount']>>[1]>;
  } | null>(null);
  const [height, setHeight] = useState(26);
  const [rows, setRows] = useState(1);

  useEffect(() => {
    if (!instance) return;
    const { editor, monaco } = instance;
    const disposables: IDisposable[] = [];
    if (!registeredLanguages.has(monaco)) {
      if (!monaco.languages.getLanguages().some((language) => language.id === GQL_LANG_ID)) {
        monaco.languages.register({ id: GQL_LANG_ID });
      }
      monaco.languages.setLanguageConfiguration(GQL_LANG_ID, {
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" },
          { open: '`', close: '`' },
          { open: '"""', close: '"""' },
          { open: "'''", close: "'''" },
        ],
        onEnterRules: [
          {
            beforeText: /^\s*('''|""")\s*$/,
            afterText: /^\s*('''|""")\s*$/,
            action: { indentAction: monaco.languages.IndentAction.IndentOutdent, appendText: '' },
          },
        ],
      });
      monaco.languages.setMonarchTokensProvider(GQL_LANG_ID, GQL_HIGHLIGHT_CONFIG);
      registeredLanguages.add(monaco);
    }

    // Monaco providers are global; restrict each instance to its own model.
    disposables.push(
      monaco.languages.registerCompletionItemProvider(GQL_LANG_ID, {
        triggerCharacters: [' '],
        provideCompletionItems: (model, position) => {
          if (model !== editor.getModel()) return { suggestions: [] };
          const word = model.getWordUntilPosition(position);
          const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
          const items = [
            ...GQL_KEYWORDS.map((label) => ({
              label,
              detail: 'Keyword',
              sortText: '2',
              kind: monaco.languages.CompletionItemKind.Keyword,
            })),
            ...GQL_PROCEDURES.map((label) => ({
              label,
              detail: 'Procedure',
              sortText: '1',
              kind: monaco.languages.CompletionItemKind.Function,
            })),
          ];
          if (/use\s+$/i.test(model.getLineContent(position.lineNumber).slice(0, position.column - 1))) {
            items.push(
              ...(latest.current.graphNames ?? []).map((label) => ({
                label,
                detail: 'Graph',
                sortText: '0',
                kind: monaco.languages.CompletionItemKind.Text,
              }))
            );
          }
          return { suggestions: items.map((item) => ({ ...item, insertText: item.label, range })) };
        },
      })
    );
    disposables.push(
      monaco.languages.registerInlineCompletionsProvider(GQL_LANG_ID, {
        provideInlineCompletions: (model, position) => {
          if (model !== editor.getModel()) return { items: [] };
          const line = model.getLineContent(position.lineNumber);
          const graph = latest.current.graphNames?.[0];
          if (/use$/i.test(line) && graph)
            return { items: [{ insertText: `USE ${graph} MATCH (v) RETURN v LIMIT 1` }] };
          return { items: /show$/i.test(line) ? [{ insertText: 'SHOW GRAPH TYPES' }] : [] };
        },
        freeInlineCompletions() {},
      })
    );

    disposables.push(
      editor.addAction({
        id: 'submit-gql',
        label: t('run'),
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
        run: () => {
          if (!latest.current.readOnly) latest.current.onSubmit?.();
        },
      })
    );
    disposables.push(
      editor.addAction({
        id: 'clear',
        label: t('clear'),
        contextMenuGroupId: 'z_custom',
        contextMenuOrder: 1,
        run: () => {
          if (!latest.current.readOnly) latest.current.onClear?.();
        },
      })
    );
    const updateHeight = () => {
      const count = editor.getModel()?.getLineCount() ?? 1;
      setRows(count);
      setHeight(editor.getContentHeight() + editor.getOption(monaco.editor.EditorOption.lineHeight) + 8);
      latest.current.onRowCountChange?.(count);
    };
    disposables.push(editor.onDidContentSizeChange(updateHeight));
    if (latest.current.autoHeight)
      editor.updateOptions({ cursorStyle: 'line', cursorBlinking: 'blink', cursorWidth: 8 });
    updateHeight();
    latest.current.onReady?.(editor);
    return () => {
      disposables.forEach((item) => item.dispose());
      latest.current.onReady?.(undefined);
    };
  }, [instance, t]);

  return (
    <MonacoEditor
      language={GQL_LANG_ID}
      value={props.value}
      onChange={props.onChange}
      readOnly={props.readOnly}
      themeMode={theme.palette.mode}
      linePrefix={rows <= 1 ? props.prompt : undefined}
      height={props.autoHeight ? height : props.height}
      placeholder={props.placeholder}
      onMount={(editor, monaco) => {
        if (monaco) setInstance({ editor, monaco });
      }}
      className={
        props.autoHeight
          ? css`
              padding-top: ${rows <= 1 ? 8 : 0}px;
              min-height: 40px;
              max-height: ${props.maxHeight ?? '400px'};
              overflow-y: auto;
              .find-widget {
                right: 50px !important;
              }
              .find-widget.visible {
                right: 50px !important;
                top: 8px !important;
              }
              .replace-part {
                right: 50px !important;
              }
            `
          : undefined
      }
    />
  );
}
