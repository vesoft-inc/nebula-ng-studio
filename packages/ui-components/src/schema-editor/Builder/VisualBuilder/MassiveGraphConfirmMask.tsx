import { Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function MassiveGraphConfirmMask({
  nodesCount,
  edgesCount,
  onConfirm,
}: {
  nodesCount: number;
  edgesCount: number;
  onConfirm: () => void;
}) {
  const { t } = useTranslation(['graphtype']);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
      }}
    >
      <Stack spacing={2} alignItems="center" maxWidth={480} textAlign="center">
        <Typography variant="h6">{t('heavyGraphTitle', { ns: 'graphtype' })}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('heavyGraphMessage', {
            ns: 'graphtype',
            total: nodesCount + edgesCount,
            nodes: nodesCount,
            edges: edgesCount,
          })}
        </Typography>
        <Stack direction="row" spacing={4} sx={{ pt: 1 }}>
          <Button variant="contained" onClick={() => onConfirm()}>
            {t('heavyGraphConfirm', { ns: 'graphtype' })}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
