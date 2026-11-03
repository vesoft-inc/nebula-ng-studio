import { Box } from '@mui/material';
import { Outlet } from '@tanstack/react-router';
import SchemaSidebar from './-Sidebar';

export function SchemaLayout() {
  return (
    <Box display="flex" height="100%" sx={{ background: (theme) => theme.palette.vesoft.v2.bg1 }}>
      <SchemaSidebar />
      <Box
        position="relative"
        flex={1}
        minWidth={0}
        sx={{ py: 3, overflow: 'auto', background: (theme) => theme.palette.vesoft.v2.bg2 }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
