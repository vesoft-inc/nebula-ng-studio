import { ReactNode } from 'react';
import { Box, Skeleton, Tooltip, Typography } from '@mui/material';

interface IProps {
  title: ReactNode | string | undefined;
  maxWidth?: number;
  skeletonWidth?: number;
  slotProps?: {};
}

function TitleEllipsis(props: IProps) {
  const { title, maxWidth = 300, skeletonWidth = 120, slotProps = {} } = props;

  return (
    <Typography maxWidth={maxWidth} overflow="hidden" textOverflow="ellipsis" {...slotProps}>
      {title ? (
        <Tooltip title={title} placement="bottom-start">
          <Box component="span" sx={{ whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
            {title}
          </Box>
        </Tooltip>
      ) : (
        <Skeleton width={skeletonWidth} />
      )}
    </Typography>
  );
}

export default TitleEllipsis;
