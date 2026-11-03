import { createFileRoute } from '@tanstack/react-router';
import { GraphTypeBuildMode } from '@vesoft-inc/studio-ui-internal/schema/types';
import { EditorPage } from './-Editor';
export const Route = createFileRoute('/_app/_schema/schema-manager/graphtype/create')({ component: Page });
function Page() {
  return <EditorPage mode={GraphTypeBuildMode.Create} />;
}
