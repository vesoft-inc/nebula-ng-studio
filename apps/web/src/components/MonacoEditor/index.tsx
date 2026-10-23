import { useEffect } from 'react';
import Typography from '@mui/material/Typography';
import { css, cx } from '@emotion/css';
import * as monaco from './monaco';
import Editor, { loader, useMonaco } from '@monaco-editor/react';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import JSONWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import { useTheme } from '@mui/material';
import { gqlTheme } from './gqlTheme';

type Monaco = typeof monaco;

// avoid loading monaco twice
if (!loader.__getMonacoInstance()) {
  loader.config({ monaco });
  loader.init();

  self.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'typescript' || label === 'javascript') {
        return new TypeScriptWorker();
      } else if (label === 'json') {
        return new JSONWorker();
      }
      return new EditorWorker();
    },
  };
}

export interface MonacoEditorProps {
  value?: string;
  onChange?: (value?: string) => void;
  /** dark | light */
  themeMode?: string;
  readOnly?: boolean;
  language?: string;
  linePrefix?: string;
  height?: number;
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor, monaco?: Monaco) => void;
  placeholder?: React.ReactNode;
  className?: string;
}

export default function MonacoEditor(props: MonacoEditorProps) {
  const theme = useTheme();
  const {
    themeMode = 'light',
    onChange,
    value,
    readOnly = false,
    language,
    onMount,
    placeholder,
    linePrefix,
    height,
  } = props;
  const monaco = useMonaco();
  const isDark = themeMode === 'dark';
  const finClassName = cx(
    css`
      /* height: ${height}px; */
      height: ${height}px;
    `,
    props.className
  );

  const monacoTheme = isDark ? 'ng-dark' : 'ng-light';

  useEffect(() => {
    if (!monaco) {
      return;
    }
    // Monaco accept only one theme for all editors when on the same time rendered.
    // https://github.com/microsoft/monaco-editor/issues/338
    if (isDark) {
      monaco.editor.defineTheme('ng-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [...gqlTheme.dark.rules],
        colors: {
          'editor.background': `${theme.palette.vesoft.v2.bg2}`,
          'editorGutter.background': `${theme.palette.vesoft.v2.bg2}`, // line number gutter color
          'editorLineNumber.foreground': `${theme.palette.vesoft.v2.text3}`, // line number color
          'editorLineNumber.activeForeground': `${theme.palette.vesoft.v2.text3}`,
          focusBorder: '#3F3F46',
          ...gqlTheme.dark.colors,
        },
      });
    } else {
      monaco.editor.defineTheme('ng-light', {
        base: 'vs',
        inherit: true,
        rules: [...gqlTheme.light.rules],
        colors: {
          'editor.background': `${theme.palette.vesoft.v2.bg2}`,
          'editorGutter.background': `${theme.palette.vesoft.v2.bg2}`,
          'editorLineNumber.foreground': `${theme.palette.vesoft.v2.text3}`, // line number color
          'editorLineNumber.activeForeground': `${theme.palette.vesoft.v2.text3}`,
          focusBorder: '#E4E4E7',
          ...gqlTheme.light.colors,
        },
      });
    }
    monaco.editor.setTheme(monacoTheme);
  }, [monaco, isDark]);

  return (
    <>
      <Editor
        theme={monacoTheme}
        value={value}
        width={'100%'}
        language={language}
        options={{
          folding: false,
          scrollbar: {
            // vertical: 'hidden',
            horizontal: 'hidden',
          },
          roundedSelection: false,
          scrollBeyondLastLine: false,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          overviewRulerLanes: 0,
          lineNumbersMinChars: 0,
          lineNumbers: (value) => linePrefix || `${value}`,
          lineDecorationsWidth: (linePrefix ? (linePrefix.length || 0) * 4 : 0) + 12,
          renderLineHighlight: 'none',
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          tabSize: 2,
          padding: { top: 4, bottom: 4 },
          fontFamily: 'Menlo, Monaco',
          automaticLayout: true,
          fixedOverflowWidgets: true,
          wordWrap: 'on',
        }}
        className={finClassName}
        onChange={onChange}
        onMount={onMount}
      />
      {placeholder && (
        <Typography
          sx={{
            position: 'absolute',
            left: `${(linePrefix?.length || 4) * 8}px`,
            top: '6px',
            color: ({ palette }) => palette.action.disabled,
            display: value ? 'none' : 'inherit',
            userSelect: 'none',
            cursor: 'text',
            fontSize: '14px',
            opacity: 0.8,
          }}
          component="code"
          variant="subtitle1"
          onClick={() => monaco?.editor.getEditors()?.[0]?.focus()}
        >
          {placeholder}
        </Typography>
      )}
    </>
  );
}
