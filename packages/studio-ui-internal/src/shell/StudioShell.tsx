import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { StudioHeader, type StudioHeaderProps } from './StudioHeader';

export interface StudioShellProps {
  children: ReactNode;
  header?: ReactNode;
  headerProps?: StudioHeaderProps;
  overlays?: ReactNode;
  height?: number | string;
}
export function StudioShell({ children, header, headerProps, overlays, height = '100vh' }: StudioShellProps) {
  return (
    <Box display="flex" flexDirection="column" height={height} minHeight={0}>
      {header ?? (headerProps && <StudioHeader {...headerProps} />)}
      <Box
        component="main"
        flex={1}
        minHeight={0}
        sx={{ backgroundColor: (theme) => theme.palette.vesoft.bgColor, overflow: 'auto' }}
      >
        {children}
      </Box>
      {overlays}
    </Box>
  );
}
