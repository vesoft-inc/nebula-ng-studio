import { useCallback, useImperativeHandle, useRef, type ReactElement, type ReactNode, type Ref } from 'react';
import { GqlEditor as InternalEditor } from '@vesoft-inc/studio-ui-internal/editor';

export interface GqlEditorHandle {
  focus: () => void;
}
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
  onRowCountChange?: (count: number) => void;
  placeholder?: ReactNode;
  ref?: Ref<GqlEditorHandle>;
}
export type GqlViewerProps = Omit<GqlEditorProps, 'readOnly' | 'onChange'>;
export function GqlEditor({ ref, ...props }: GqlEditorProps): ReactElement {
  const editor = useRef<GqlEditorHandle | undefined>(undefined);
  const bindEditor = useCallback((instance: GqlEditorHandle | undefined) => {
    editor.current = instance;
  }, []);
  useImperativeHandle(ref, () => ({ focus: () => editor.current?.focus() }), []);
  return <InternalEditor {...props} onReady={bindEditor} />;
}
export function GqlViewer(props: GqlViewerProps): ReactElement {
  return <GqlEditor {...props} readOnly />;
}
