import { Paper, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { WarningOutlined } from '@vesoft-inc/icons';
import { ConsoleResult } from '@vesoft-inc/utils';
import { useTranslation } from 'react-i18next';

export const WarningCount = ({ result }: { result: ConsoleResult }) => {
  const theme = useTheme();
  const { t } = useTranslation(['console']);
  const warningCount = result.warnings?.length || 0;

  if (warningCount === 0) {
    return null;
  }

  return (
    <Tooltip
      slotProps={{
        tooltip: {
          sx: {
            padding: 0,
            margin: 0,
            width: '50vw',
            minWidth: '400px',
            maxWidth: '500px',
          },
        },
      }}
      placement="top"
      title={
        <Paper
          sx={{
            width: '100%',
            height: '100%',
            padding: '8px',
            boxShadow: `0px 2px 6px 0px ${theme.palette.vesoft.v2.divider2}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {result.warnings?.map((warning) => (
            <Typography
              fontSize={12}
              fontWeight={400}
              color={theme.palette.vesoft.v2.text1}
            >{`${warning.code}: ${warning.message}`}</Typography>
          ))}
        </Paper>
      }
    >
      <Stack direction="row" alignItems="center" gap="4px">
        <WarningOutlined sx={{ width: 14, height: 14, color: theme.palette.vesoft.v2.warning2 }} />
        <Typography fontSize={12} fontWeight={400} color={theme.palette.vesoft.v2.text3}>
          {t('warningCount', { ns: 'console', count: warningCount })}
        </Typography>
      </Stack>
    </Tooltip>
  );
};
