import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/_app/explorer/')({
  beforeLoad: () => {
    throw redirect({ to: '/explorer/snapshots', replace: true });
  },
});
