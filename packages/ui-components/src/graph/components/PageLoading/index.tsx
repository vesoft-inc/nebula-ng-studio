import { Box, BoxProps } from '@mui/material';
import { hexToRgba } from '@vesoft-inc/utils';
import pageLoading from '../../../assets/loading.gif?url';
import logoLoading from '../../../assets/logo-loading.gif?url';

interface PageLoadingProps {
  slotProps?: {
    container: BoxProps;
    image: BoxProps;
  };
  containerSx?: BoxProps['sx'];
  logo?: boolean;
}

function PageLoading(props: PageLoadingProps) {
  const { slotProps, containerSx, logo } = props;
  return (
    <Box
      component="div"
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        backgroundColor: (theme) => hexToRgba(theme.palette.vesoft.v2.bg1, 0.6),
        backdropFilter: 'blur(4px)',
        ...containerSx,
      }}
      {...slotProps?.container}
    >
      <Box
        component="img"
        sx={{
          width: '90px',
          height: '90px',
        }}
        src={logo ? logoLoading : pageLoading}
        {...slotProps?.container}
      />
    </Box>
  );
}

export default PageLoading;
