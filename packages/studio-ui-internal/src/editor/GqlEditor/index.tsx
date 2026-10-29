import { lazy, Suspense } from 'react';
import type { GqlEditorProps } from '../types';
import { GQL_KEYWORDS, GQL_PROCEDURES } from '../keywords';

const Editor = lazy(() => import('./Editor'));
export const LazyMonacoEditor = lazy(() => import('../MonacoEditor'));
export const highlightKeywords = [...GQL_KEYWORDS, ...GQL_KEYWORDS.map((key) => key.toLowerCase()), ...GQL_PROCEDURES];

export default function GqlEditor(props: GqlEditorProps) {
  return (
    <Suspense>
      <Editor {...props} />
    </Suspense>
  );
}

export function GqlViewer(props: Omit<GqlEditorProps, 'readOnly' | 'onChange'>) {
  return <GqlEditor {...props} readOnly />;
}
