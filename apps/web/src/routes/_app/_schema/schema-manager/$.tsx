import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/_app/_schema/schema-manager/$')({
  beforeLoad: () => {
    throw redirect({ to: '/schema-manager/graphtype', replace: true });
  },
});
