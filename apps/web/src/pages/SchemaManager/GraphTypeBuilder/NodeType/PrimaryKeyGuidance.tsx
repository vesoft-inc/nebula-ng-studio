import { Box, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { NodePrimaryKeyError, NodePrimaryKeyPropertyIssue } from '../validation';

export function PrimaryKeyGuidance({
  error,
  issues,
}: {
  error: NodePrimaryKeyError;
  issues: NodePrimaryKeyPropertyIssue[];
}) {
  const { t } = useTranslation('graphtype');
  const first = error === 'nodePrimaryKeyInvalid' ? issues[0] : undefined;
  const message = (issue: NodePrimaryKeyPropertyIssue) =>
    t(
      !issue.property.name.trim() && issue.reason !== 'nodePrimaryKeyNameRequired'
        ? `${issue.reason}Unnamed`
        : issue.reason,
      { property: issue.property.name.trim(), index: issue.index + 1, type: issue.property.type }
    );
  const hint = (
    <Typography
      role="status"
      variant="body2"
      color="warning.dark"
      title={first && issues.length > 1 ? message(first) : undefined}
      sx={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    >
      {first ? message(first) : t(error)}
    </Typography>
  );
  if (!first) return hint;
  const details = (
    <Stack spacing={1.5}>
      {issues.map((issue) => (
        <Box key={`${issue.index}-${issue.reason}`} sx={{ overflowWrap: 'anywhere' }}>
          <Typography variant="body2">{message(issue)}</Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {t(`${issue.reason}Action`)}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
  if (issues.length === 1) {
    return (
      <Tooltip arrow describeChild title={details}>
        {hint}
      </Tooltip>
    );
  }
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0.5,
        minWidth: 0,
        maxWidth: '100%',
        color: 'warning.dark',
        typography: 'body2',
      }}
    >
      {hint}
      <Tooltip arrow describeChild title={details}>
        <ButtonBase
          type="button"
          aria-label={t('nodePrimaryKeyMoreIssues', { count: issues.length - 1 })}
          sx={{
            minWidth: 0,
            px: 0.25,
            py: 0,
            borderRadius: 0.5,
            flexShrink: 0,
            color: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            fontWeight: 600,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'none', backgroundColor: 'action.hover' },
            '&.Mui-focusVisible': { outline: '2px solid currentColor', outlineOffset: 2 },
          }}
        >
          ({issues.length - 1})
        </ButtonBase>
      </Tooltip>
    </Box>
  );
}
