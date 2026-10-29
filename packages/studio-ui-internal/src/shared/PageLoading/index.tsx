import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

import pageLoadingImg from '../../assets/page_loading.png?url';

const PageLoadingContainer = styled(Box)`
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 600px;
`;

const PageLoadingImage = styled('img')`
  width: 90px;
  height: 90px;
`;

function PageLoading() {
  return (
    <PageLoadingContainer>
      <PageLoadingImage src={pageLoadingImg} />
    </PageLoadingContainer>
  );
}

export default PageLoading;
