import { Alert, Box, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function PageError() {
  const { t } = useTranslation('app');
  return (
    <Box p={3}>
      <Alert severity="error" action={<Button onClick={() => window.location.reload()}>{t('reload')}</Button>}>
        {t('pageLoadFailed')}
      </Alert>
    </Box>
  );
}
