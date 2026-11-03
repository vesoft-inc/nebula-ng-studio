import { createFileRoute, redirect } from '@tanstack/react-router';
import { GraphTypeBuildMode } from '@vesoft-inc/studio-ui-internal/schema/types';
import { EditorPage } from '../-Editor';
export const Route = createFileRoute('/_app/_schema/schema-manager/graphtype/sketch/$sketchId')({
  beforeLoad: ({ params }) => {
    if (!/^[1-9]\d*$/.test(params.sketchId) || !Number.isSafeInteger(Number(params.sketchId)))
      throw redirect({ to: '/schema-manager/graphtype', replace: true });
  },
  component: Page,
});
function Page() {
  return <EditorPage mode={GraphTypeBuildMode.Sketch} sketchId={Number(Route.useParams().sketchId)} />;
}
