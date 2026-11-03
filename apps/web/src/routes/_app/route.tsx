import { createFileRoute } from '@tanstack/react-router';
import { SessionGate } from '@studio/app/SessionGate';
import PageLayout from '@studio/components/PageLayout';
export const Route = createFileRoute('/_app')({
  component: () => (
    <SessionGate>
      <PageLayout />
    </SessionGate>
  ),
});
