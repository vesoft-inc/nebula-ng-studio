import type { ReactNode } from 'react';
import type { editor } from 'monaco-editor';

export interface GqlEditorProps {
  value: string;
  onChange?: (value?: string) => void;
  readOnly?: boolean;
  graphNames?: string[];
  prompt?: string;
  autoHeight?: boolean;
  height?: number | string;
  maxHeight?: string;
  onSubmit?: () => void;
  onClear?: () => void;
  onReady?: (editor: editor.IStandaloneCodeEditor | undefined) => void;
  onRowCountChange?: (count: number) => void;
  placeholder?: ReactNode;
}
