import { Outlet } from 'react-router-dom';
import { StudioShell } from '@vesoft-inc/ui-components/shell';
import PageHeader from '@studio/components/PageHeader';

export default function PageLayout() {
  return (
    <StudioShell header={<PageHeader />}>
      <Outlet />
    </StudioShell>
  );
}
