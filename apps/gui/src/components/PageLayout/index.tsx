import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { MainContentContainer } from './styles';
import PageHeader from '../PageHeader';
import LoginModal from '../LoginModal';

export default function PageLayout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader />
      <Box sx={{ display: 'flex' }}>
        <MainContentContainer>
          <Outlet />
        </MainContentContainer>
      </Box>
      <LoginModal />
    </Box>
  );
}
