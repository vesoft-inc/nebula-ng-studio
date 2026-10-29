import { Outlet } from 'react-router-dom';
import { StudioShell } from '@vesoft-inc/studio-ui-internal/shell';
import PageHeader from '../PageHeader';
import LoginModal from '../LoginModal';

export default function PageLayout() {
  return (
    <StudioShell header={<PageHeader />} overlays={<LoginModal />}>
      <Outlet />
    </StudioShell>
  );
}
