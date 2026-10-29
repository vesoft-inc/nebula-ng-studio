import { Backdrop, Box, CircularProgress, IconButton, Typography, useTheme } from '@mui/material';
import { CustomBackdrop, CustomDrawer } from './styles';
import { CloseFilled } from '@vesoft-inc/icons';
import { useTranslation } from 'react-i18next';
import { PropsWithChildren } from 'react';

export function SettingsBackdrop({ open, onClose }: { open: boolean; onClose?: () => void }) {
  if (!open) return null;
  return <CustomBackdrop onClick={onClose} />;
}

export function SettingsDrawer({
  open,
  loading,
  onClose,
  backdrop = true,
  children,
}: PropsWithChildren<{
  open: boolean;
  loading?: boolean;
  onClose?: () => void;
  backdrop?: boolean;
}>) {
  const theme = useTheme();
  const { t } = useTranslation(['explorer'], { keyPrefix: 'settings' });
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* Custom Settings Drawer and Backdrop */}
      {backdrop && <SettingsBackdrop open={open} onClose={onClose} />}
      <CustomDrawer open={open} onClick={(e) => e.stopPropagation()}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: `1px solid ${theme.palette.vesoft.v2.divider2}`,
          }}
        >
          <Typography
            variant="h6"
            sx={{ color: theme.palette.vesoft.v2.text1, fontWeight: 'semibold', fontSize: '16px' }}
          >
            {t('settings')}
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{
              color: theme.palette.vesoft.v2.text2,
              '&:hover': {
                color: theme.palette.vesoft.v2.text1,
                backgroundColor: theme.palette.vesoft.v2.bg3,
              },
            }}
          >
            <CloseFilled sx={{ width: 24, height: 24 }} />
          </IconButton>
        </Box>
        <Box sx={{ color: theme.palette.vesoft.v2.text2, position: 'relative', minHeight: 120 }}>
          <Backdrop open={Boolean(loading)} sx={{ zIndex: theme.zIndex.modal }}>
            <CircularProgress />
          </Backdrop>
          <Box sx={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto' }}>{children}</Box>
        </Box>
      </CustomDrawer>
    </Box>
  );
}
