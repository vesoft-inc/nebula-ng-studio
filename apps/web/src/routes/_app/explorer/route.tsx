import { createFileRoute } from '@tanstack/react-router';
import ExplorerLayout from './-Layout';
export const Route = createFileRoute('/_app/explorer')({
  staticData: { section: 'explorer' },
  component: ExplorerLayout,
});
