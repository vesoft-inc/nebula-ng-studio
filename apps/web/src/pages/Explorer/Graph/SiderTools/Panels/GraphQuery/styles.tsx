import { getDirection, SelectProps } from '@studio/utils/graph/helpers';
import { PathFilterType } from '@studio/utils/explorer/constant';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { NodeObject } from '@vesoft-inc/force-graph';
import { HelpCircleOutline } from '@vesoft-inc/icons';
import { EdgeDirectionType } from '@vesoft-inc/utils';
import { SelectElement } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';

export const QueryTitle = styled(Typography)`
  color: ${({ theme }) => theme.palette.vesoft.textColor1};
  font-weight: 500;
  line-height: ${({ theme }) => theme.spacing(2)};
`;

export const NodeItemBar = ({ node }: { node?: NodeObject }) => {
  const { t } = useTranslation(['explorer']);
  return node ? (
    <Box
      display="flex"
      alignItems="center"
      sx={{
        backgroundColor: (theme) => theme.palette.vesoft.v2.bg3,
        border: (theme) => `1px solid ${theme.palette.vesoft.v2.border2}`,
        borderRadius: 1,
        height: 36,
        padding: (theme) => `0 ${theme.spacing(1)}`,
        color: (theme) => theme.palette.vesoft.v2.text2,
        '&:not(:last-child)': {
          marginBottom: (theme) => theme.spacing(1),
        },
      }}
    >
      <Chip
        sx={{
          backgroundColor: node.color as string,
          borderRadius: '50%',
          width: 24,
          height: 24,
          mr: 1,
        }}
      />
      <Tooltip placement="top" title={node.label as string}>
        <Typography
          // component="span"
          fontWeight={500}
          sx={{
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            color: (theme) => theme.palette.vesoft.textColor2,
          }}
        >
          {node.label as string}
        </Typography>
      </Tooltip>
    </Box>
  ) : (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      sx={{
        backgroundColor: (theme) => theme.palette.vesoft.v2.bg6,
        border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider2}`,
        borderRadius: 1,
        height: 36,
        color: (theme) => theme.palette.vesoft.v2.text3,
      }}
    >
      {t('noSelectedVertex', { ns: 'explorer' })}
    </Box>
  );
};

const DirectionLabel = ({ label }: { label: React.ReactNode }) => (
  <Box
    sx={{
      borderRadius: '4px',
      width: 26,
      height: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // padding: 'none',
      mr: 1,
      fontSize: 12,
      padding: '0 5px',
      backgroundColor: (theme) => theme.palette.vesoft.v2.bg7,
    }}
  >
    {label}
  </Box>
);

export const DirectionSelector = () => {
  const { t } = useTranslation(['explorer']);
  const directionOptions = [
    {
      label: t('forward', { ns: 'explorer' }),
      value: EdgeDirectionType.Forward,
    },
    {
      label: t('backward', { ns: 'explorer' }),
      value: EdgeDirectionType.Backward,
    },
    {
      label: t('bidirect', { ns: 'explorer' }),
      value: EdgeDirectionType.Bidirect,
    },
    {
      label: t('undirected', { ns: 'explorer' }),
      value: EdgeDirectionType.Undirected,
    },
    {
      label: t('backOrUndirected', { ns: 'explorer' }),
      value: EdgeDirectionType.BackOrUndirected,
    },
    {
      label: t('forwardOrUndirected', { ns: 'explorer' }),
      value: EdgeDirectionType.ForwardOrUndirected,
    },
    {
      label: t('anyDirection', { ns: 'explorer' }),
      value: EdgeDirectionType.AnyDirection,
    },
  ];

  return (
    <SelectElement
      name="direction"
      // label={t('direction', { ns: 'explorer' })}
      fullWidth
      size="small"
      labelKey="label"
      valueKey="value"
      SelectProps={SelectProps}
      sx={{ mt: 1 }}
      options={directionOptions.map((item) => ({
        label: (
          <Stack direction="row" alignItems="center">
            <DirectionLabel label={getDirection(item.value).join('')} />
            {item.label}
          </Stack>
        ),
        value: item.value,
      }))}
    />
  );
};

export const PathFilterTypeSelector = () => {
  const { t } = useTranslation(['explorer']);
  const PathFilterTypeTipMap = {
    [PathFilterType.ACYCLIC]: t('acyclicTip', { ns: 'explorer' }),
    [PathFilterType.SIMPLE]: t('simpleTip', { ns: 'explorer' }),
    [PathFilterType.TRAIL]: t('trailTip', { ns: 'explorer' }),
    [PathFilterType.WALK]: t('walkTip', { ns: 'explorer' }),
  };

  return (
    <SelectElement
      name="pathFilterType"
      fullWidth
      size="small"
      labelKey="label"
      valueKey="value"
      SelectProps={SelectProps}
      sx={{ mt: 1 }}
      options={Object.values(PathFilterType).map((type) => ({
        label: (
          <Stack direction="row" alignItems="center">
            {type}
            <Tooltip placement="right" sx={{ ml: 1 }} title={PathFilterTypeTipMap[type]}>
              <HelpCircleOutline fontSize="small" />
            </Tooltip>
          </Stack>
        ),
        value: type,
      }))}
    />
  );
};

export const enum StepType {
  Single = 'Single',
  Range = 'Range',
}
