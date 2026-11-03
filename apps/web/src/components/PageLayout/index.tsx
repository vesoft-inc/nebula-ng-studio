import { Outlet } from '@tanstack/react-router';
import { StudioShell } from '@vesoft-inc/studio-ui-internal/shell';
import PageHeader from '@studio/components/PageHeader';

export default function PageLayout() {
  return (
    <StudioShell header={<PageHeader />}>
      <Outlet />
    </StudioShell>
  );
}
