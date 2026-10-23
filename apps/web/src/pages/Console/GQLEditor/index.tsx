import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';
import { KeyMod, KeyCode, Range, type languages, IDisposable } from '@studio/components/MonacoEditor/monaco';
import * as monaco from '@studio/components/MonacoEditor/monaco';
import { commonStore, consoleStore } from '@studio/stores/session';
import type { MonacoEditorProps } from '@studio/components/MonacoEditor';
import { GQL_LANG_ID as langId } from '@studio/utils/constant/editor';
import { GQL_KEYWORDS, GQL_PROCEDURES } from '@studio/utils/constant/nebula';
import { LazyMonacoEditor } from '@studio/components/GQLEditorLite';
import { css } from '@emotion/css';
import { useTranslation } from 'react-i18next';
import { brandConfig, isGuiTarget } from '@studio/utils';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Play, Stop } from '@vesoft-inc/icons';
import { GQL_HIGHLIGHT_CONFIG } from './highlight';
import { GQLResult, RequestQueue } from '@vesoft-inc/utils';
import { execConsoleGql } from '@studio/services';
import { killQueriesBySessionId as killQueriesBySessionId4Gui } from '@gui/services';
import { killQueriesBySessionId as killQueriesBySessionId4Studio } from '@studio/services';
import { ConsoleSettingsForm } from '@studio/components/Settings/constants';

const commandEvent4RunGql = new Event('_custom_monaco_command_event');

function GQLEditor({
  settings,
  maxHeight = '400px',
  onRunGql,
  onAfterRunGql,
}: {
  settings?: ConsoleSettingsForm;
  maxHeight?: string;
  onRunGql?: () => void | Promise<void>;
  onAfterRunGql?: () => void | Promise<void>;
}) {
  const theme = useTheme();
  const disposeRef = useRef<{ name: string; disposer: IDisposable }[]>([]);
  const { graphs, editorRowCount } = consoleStore;
  const { userInfo } = commonStore;

  const consolePrompt = `[${brandConfig.consolePrompt}]>   `;
  const prefix = userInfo ? consolePrompt : '';
  const guiPrefix = consolePrompt;
  const [editorHeight, setEditorHeight] = useState<number>(26);
  const { t } = useTranslation(['console']);

  const loading = consoleStore.editorRunning;
  useEffect(() => {
    if (isGuiTarget) return;
    consoleStore.getGraphs();
  }, []);

  const [currentSessionId, setCurrentSessionId] = useState<string>();
  const [requestQueue] = useState(() => new RequestQueue({ concurrency: 1 }));
  const runningTaskId = useRef<string>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const handleRunGql = useCallback(async () => {
    if (isRunning) return; // Prevent multiple executions
    setIsRunning(true);

    await onRunGql?.();
    try {
      const gql = consoleStore.editorValue;

      if (!currentSessionId) {
        const { promise } = requestQueue.add(() => execConsoleGql<GQLResult<{ id: string }>>(`SHOW CURRENT_SESSION`));
        const session = await promise;
        if (session) {
          const sessionId = session.data?.tables[0]?.id?.toString();
          if (sessionId) {
            setCurrentSessionId(sessionId);
          }
        }
      }

      // 只有 GUI 运行时会透传该 header；Studio 的查询超时由 Server 统一设置
      let customHeaders = {};
      if (isGuiTarget) {
        if (typeof settings?.queryTimeout === 'number' && settings.queryTimeout > 0) {
          customHeaders = {
            'X-Request-Timeout': settings.queryTimeout * 1000,
          };
        }
      }

      // 直接传递原始 GQL 语句，处理逻辑已移到 runGql 内部
      const { id, promise } = requestQueue.add((signal) =>
        consoleStore.runGql(gql, {
          queryTimeout: (settings?.queryTimeout ?? 0) * 1000,
          signal,
          headers: {
            ...customHeaders,
          },
        })
      );
      runningTaskId.current = id;
      await promise;
    } catch (err) {
      console.error('Failed to run gql:', err);
    } finally {
      setIsRunning(false);
      onAfterRunGql?.();
    }
  }, [consoleStore, isRunning, requestQueue, settings, currentSessionId]);

  const handleStopGql = useCallback(async () => {
    if (!currentSessionId) {
      return;
    }

    setIsStopping(true);

    if (runningTaskId.current) {
      requestQueue.abort(runningTaskId.current);
      runningTaskId.current = null;
    } else {
      requestQueue.abortAll();
    }

    try {
      if (isGuiTarget) {
        await killQueriesBySessionId4Gui(currentSessionId);
      } else {
        await killQueriesBySessionId4Studio(currentSessionId);
      }
    } catch (err) {
      console.error('Failed to stop gql:', err);
    }

    setIsStopping(false);
    setIsRunning(false);
    consoleStore.unsafeAction(() => (consoleStore.editorRunning = false));
  }, [consoleStore, currentSessionId, requestQueue]);

  // Fix monaco editor command not respect props change
  useEffect(() => {
    window.addEventListener(commandEvent4RunGql.type, handleRunGql);
    return () => window.removeEventListener(commandEvent4RunGql.type, handleRunGql);
  }, [handleRunGql]);

  const onMount: NonNullable<MonacoEditorProps['onMount']> = (editor, monaco) => {
    // quick submit
    // editor?.addCommand(KeyMod.Shift | KeyCode.Enter, handleRunGql);
    editor?.addCommand(KeyMod.Shift | KeyCode.Enter, () => {
      window.dispatchEvent(commandEvent4RunGql);
    });

    // Add context menu action for "Clear"
    const clearAction = editor?.addAction({
      id: 'clear',
      label: t('clear', { ns: 'console' }),
      contextMenuGroupId: 'z_custom',
      contextMenuOrder: 1,
      run: () => {
        consoleStore.updateEditorValue();
      },
    });

    const getLineHeight = (lineNumber: number) => {
      const topForCurrentLine = editor.getTopForLineNumber(lineNumber);
      const topForNextLine = editor.getTopForPosition(lineNumber + 1, 1);
      return topForNextLine - topForCurrentLine;
    };

    const updateEditorHeight = () => {
      const lineCount = editor?.getModel()?.getLineCount();
      let newHeight = editor.getOption(monaco!.editor.EditorOption.lineHeight) + 8;
      for (let i = 1; i <= lineCount!; i++) {
        const lineHeight = getLineHeight(i);
        if (lineHeight !== 0) {
          newHeight += lineHeight;
        }
      }
      // const lineHeight = editor.getOption(monaco!.editor.EditorOption.lineHeight);
      // const newHeight = lineCount! * lineHeight + 10; // 20 是一个缓冲高度
      setEditorHeight(newHeight);
      consoleStore.updateEditorRowCount(lineCount || 1);
    };

    setTimeout(() => {
      updateEditorHeight();
    }, 10);

    // 设置光标样式
    editor?.updateOptions({
      cursorStyle: 'line',
      cursorBlinking: 'blink',
      cursorWidth: 8,
    });

    // 监听内容变化事件
    const contentDisposer = editor.onDidChangeModelContent(() => {
      updateEditorHeight();
    });

    // register gql language
    const languages = monaco?.languages.getLanguages() || [];
    if (!languages.some((lang) => lang.id === langId)) {
      monaco?.languages.register({ id: langId });
      monaco?.languages.setLanguageConfiguration(langId, {
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
            action: {
              indentAction: monaco.languages.IndentAction.IndentOutdent,
              appendText: '',
            },
          },
        ],
      });
    }

    // Enhanced Monarch language definition for ISO standard GQL
    const highlightDisposer = monaco?.languages.setMonarchTokensProvider(langId, GQL_HIGHLIGHT_CONFIG);
    const keywordDisposer = monaco?.languages.registerCompletionItemProvider(langId, {
      provideCompletionItems: (model, position) => {
        const wordInfo = model.getWordUntilPosition(position);
        const wordRange = new Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn);
        const keywordSuggestions: languages.CompletionItem[] = GQL_KEYWORDS.map((k) => ({
          label: k,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: k,
          detail: 'Keyword',
          range: wordRange,
          // monaco completion suggestions sort by sortText, 1: keyword 2: tag 3: edge 4: field 5: function
          sortText: '2',
        }));
        const procedureSuggestions: languages.CompletionItem[] = GQL_PROCEDURES.map((p) => ({
          label: p,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: p,
          detail: 'Procedure',
          range: wordRange,
          sortText: '1',
        }));
        return { suggestions: [...keywordSuggestions, ...procedureSuggestions] };
      },
    });
    const inlineSuggestionDisposer = monaco?.languages.registerInlineCompletionsProvider(langId, {
      async provideInlineCompletions(model, position, _context, _token) {
        const lineContent = model.getLineContent(position.lineNumber);
        if (/use$/i.test(lineContent)) {
          const firstGraph = graphs[0]?.graph;
          return { items: firstGraph ? [{ insertText: `USE ${firstGraph} MATCH (v) RETURN v LIMIT 1` }] : [] };
        } else if (/show$/i.test(lineContent)) {
          return { items: [{ insertText: 'SHOW GRAPH TYPES' }] };
        }
        return { items: [] };
      },
      freeInlineCompletions() {},
    });
    disposeRef.current.push(
      { name: 'highlightDisposer', disposer: highlightDisposer! },
      { name: 'keywordDisposer', disposer: keywordDisposer! },
      { name: 'inlineSuggestionDisposer', disposer: inlineSuggestionDisposer! },
      { name: 'contentDisposer', disposer: contentDisposer },
      { name: 'clearAction', disposer: clearAction! }
    );
    consoleStore.setEditorRef(editor);
  };

  useEffect(() => {
    const graphNames = graphs.map((g) => g.graph);
    if (!graphNames.length) {
      return;
    }
    const graphProvider = monaco?.languages.registerCompletionItemProvider(langId, {
      provideCompletionItems: (model, position) => {
        // get current line text
        const line = model.getLineContent(position.lineNumber);
        const endsWithUse = /use\s+$/i.test(line);
        if (!endsWithUse) {
          return { suggestions: [] };
        }
        const wordInfo = model.getWordUntilPosition(position);
        const wordRange = new Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn);
        const suggestions: languages.CompletionItem[] = graphNames.map((name) => ({
          label: name,
          kind: monaco.languages.CompletionItemKind.Text,
          insertText: name,
          detail: 'Graph',
          range: wordRange,
        }));
        return { suggestions };
      },
      triggerCharacters: [' '],
    });
    const dispose = () => {
      const item = disposeRef.current.find((p) => p.name === 'graphProvider');
      if (item) {
        item.disposer?.dispose();
        disposeRef.current = disposeRef.current.filter((p) => p !== item);
      }
    };
    disposeRef.current.push({ name: 'graphProvider', disposer: graphProvider! });
    return dispose;
  }, [graphs]);

  useEffect(
    () => () => {
      disposeRef.current.forEach(({ disposer }) => disposer?.dispose());
      disposeRef.current = [];
      consoleStore.setEditorRef();
    },
    []
  );

  const { editorValue, updateEditorValue } = consoleStore;

  return (
    <Box
      sx={{
        position: 'relative',
        padding: '0 0 0 12px',
      }}
    >
      <Suspense>
        <LazyMonacoEditor
          language={langId}
          themeMode={theme.palette.mode}
          height={editorHeight}
          linePrefix={editorRowCount <= 1 ? (isGuiTarget ? guiPrefix : prefix) : undefined}
          value={editorValue}
          readOnly={isRunning || isStopping}
          onChange={updateEditorValue}
          onMount={onMount}
          className={css`
            padding-top: ${editorRowCount <= 1 ? 8 : 0}px;
            min-height: 40px;
            max-height: ${maxHeight};
            overflow-y: auto;
            /* Move Monaco search widget to the left to avoid collision with run button */
            .find-widget {
              right: 50px !important;
              /* top: 4px !important; */
            }
            .find-widget.visible {
              right: 50px !important;
              top: 8px !important;
            }
            /* Also handle replace widget if it appears */
            .replace-part {
              right: 50px !important;
            }
          `}
        />
      </Suspense>

      {/* Floating Run/Stop Button */}
      <Box
        sx={{
          position: 'absolute',
          top: editorRowCount <= 2 ? 8 : 18,
          right: editorRowCount <= 2 ? 8 : 18,
          zIndex: 999,
          transition: 'all 0.2s ease-in-out',
        }}
      >
        {/* TODO: Studio 中暂不支持 stop 操作 */}
        {loading && isGuiTarget ? (
          <Tooltip title={t('stop', { ns: 'console' })} placement="left">
            <IconButton
              onClick={handleStopGql}
              disabled={isStopping}
              size="small"
              sx={{
                borderRadius: '50%',
                backgroundColor: theme.palette.vesoft.v2.error2,
                color: theme.palette.common.white,
                '&:hover': {
                  backgroundColor: theme.palette.vesoft.v2.error3,
                },
              }}
            >
              <Stop sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={t('run', { ns: 'console' })} placement="left">
            <IconButton
              onClick={handleRunGql}
              disabled={isRunning || isStopping}
              size="small"
              sx={{
                borderRadius: '50%',
                backgroundColor: theme.palette.vesoft.themeColor1,
                color: theme.palette.common.white,
                '&:hover': {
                  backgroundColor: theme.palette.vesoft.themeColor2,
                },
              }}
            >
              <Play sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

const observedGQLEditor = observer(GQLEditor);

export default observedGQLEditor;
