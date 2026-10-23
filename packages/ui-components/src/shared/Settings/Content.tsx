import { Box, Stack, Typography, useTheme } from '@mui/material';
import { HelpCircleOutline } from '@vesoft-inc/icons';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import {
  DefaultValues,
  FormContainer,
  Path,
  PathValue,
  SwitchElement,
  TextFieldElement,
  useForm,
} from 'react-hook-form-mui';
import { Tooltip } from '@mui/material';
import { debounce } from 'lodash';
import { ConsoleSettingsForm, ExplorerSettingsForm } from './constants';

type SettingForm = ConsoleSettingsForm | ExplorerSettingsForm;

export function SettingsContent<T extends SettingForm>({
  initialData,
  onChange,
}: {
  initialData: T;
  onChange: (values: T) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation(['explorer'], { keyPrefix: 'settings' });
  const form = useForm<T>({
    defaultValues: initialData as DefaultValues<T>,
  });

  // Trigger onSave on any field change
  useEffect(() => {
    const debouncedOnChange = debounce(
      (values) => {
        onChange(values as T);
      },
      100,
      {
        leading: true,
        trailing: true,
      }
    );
    const subscription = form.watch(debouncedOnChange);
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  const querySettingItems = [
    {
      key: 'queryTimeout',
      label: t('queryTimeout'),
      tip: t('queryTimeoutTip'),
      min: 0,
      max: 600,
    },
    {
      key: 'maxRowsLimit',
      label: t('maxRowsLimit'),
      tip: t('maxRowsLimitTip'),
      min: 100,
      max: 5000,
    },
    {
      key: 'maxNeighborsLimit',
      label: t('maxNeighborsLimit'),
      tip: t('maxNeighborsLimitTip'),
      min: 100,
      max: 5000,
    },
  ].filter(({ key }) => key in initialData);

  const querySettingSection = (
    <Box
      sx={{
        py: '24px',
        borderBottom: `1px solid ${theme.palette.vesoft.v2.divider2}`,
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{ color: theme.palette.vesoft.v2.text2, fontSize: 16, fontWeight: 500, mb: '16px' }}
      >
        {t('querySection')}
      </Typography>

      <Stack spacing={'16px'}>
        {querySettingItems.map(({ key, label, tip, min, max }) => {
          return (
            <Stack key={key} direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Tooltip title={tip}>
                <Typography
                  sx={{
                    color: theme.palette.vesoft.v2.text2,
                    minWidth: 120,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 14,
                  }}
                >
                  {label}
                  <HelpCircleOutline sx={{ width: 16, height: 16, color: theme.palette.vesoft.v2.text3 }} />
                </Typography>
              </Tooltip>
              <TextFieldElement
                name={key}
                type="number"
                size="small"
                sx={{ maxWidth: '50%', minWidth: 120, flex: 1 }}
                slotProps={{
                  htmlInput: {
                    step: 1,
                    min,
                    max,
                  },
                }}
                onBlur={(e) => {
                  let value = Number(e.target.value);
                  if (isNaN(value)) {
                    return;
                  }

                  // Ensure integer value by rounding down
                  value = Math.floor(value);

                  if (value < min) {
                    form.setValue(key as Path<T>, min as PathValue<T, Path<T>>);
                  } else if (value > max) {
                    form.setValue(key as Path<T>, max as PathValue<T, Path<T>>);
                  } else {
                    form.setValue(key as Path<T>, value as PathValue<T, Path<T>>);
                  }
                }}
              />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );

  const visualizationSettingItems = [
    {
      key: 'displayPropertiesOnHover',
      label: t('displayPropertiesOnHover'),
      tip: t('displayPropertiesOnHoverTip'),
      type: 'switch',
    },
    {
      key: 'highlightNeighborsOnHover',
      label: t('highlightNeighborsOnHover'),
      tip: t('highlightNeighborsOnHoverTip'),
      type: 'switch',
    },
    {
      key: 'maxNodesLimit4Graph',
      label: t('maxNodesLimit4Graph'),
      tip: t('maxNodesLimit4GraphTip'),
      min: 300,
      max: 10000,
    },
  ].filter(({ key }) => key in initialData);
  const visualizationSettingSection = (
    <Box
      sx={{
        py: '24px',
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{ color: theme.palette.vesoft.v2.text2, fontSize: 16, fontWeight: 500, mb: '16px' }}
      >
        {t('visualizationSection')}
      </Typography>
      <Stack spacing={'16px'}>
        {visualizationSettingItems.map(({ key, label, tip, type, min, max }) => {
          if (type === 'switch') {
            return (
              <Stack key={key} direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Tooltip title={tip}>
                  <Typography
                    sx={{
                      color: theme.palette.vesoft.v2.text2,
                      minWidth: 120,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: 14,
                    }}
                  >
                    {label}
                    <HelpCircleOutline sx={{ width: 16, height: 16, color: theme.palette.vesoft.v2.text3 }} />
                  </Typography>
                </Tooltip>
                <SwitchElement
                  name={key}
                  labelPlacement="start"
                  label=""
                  sx={{ maxWidth: '50%', minWidth: 120, flex: 1 }}
                />
              </Stack>
            );
          }
          return (
            <Stack key={key} direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Tooltip title={tip}>
                <Typography
                  sx={{
                    color: theme.palette.vesoft.v2.text2,
                    minWidth: 120,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {label}
                  <HelpCircleOutline sx={{ width: 16, height: 16, color: theme.palette.vesoft.v2.text3 }} />
                </Typography>
              </Tooltip>
              <TextFieldElement
                name={key}
                type="number"
                size="small"
                sx={{ maxWidth: '50%', minWidth: 120, flex: 1 }}
                slotProps={{
                  htmlInput: {
                    step: 1,
                    min: min!,
                    max: max!,
                  },
                }}
                onBlur={(e) => {
                  let value = Number(e.target.value);
                  if (isNaN(value)) {
                    return;
                  }

                  // Ensure integer value by rounding down
                  value = Math.floor(value);

                  if (value < min!) {
                    form.setValue(key as Path<T>, min! as PathValue<T, Path<T>>);
                  } else if (value > max!) {
                    form.setValue(key as Path<T>, max! as PathValue<T, Path<T>>);
                  } else {
                    form.setValue(key as Path<T>, value as PathValue<T, Path<T>>);
                  }
                }}
              />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );

  return (
    <Stack sx={{ px: '24px' }}>
      <FormContainer formContext={form}>
        <Stack>
          {querySettingItems.length > 0 && querySettingSection}
          {visualizationSettingItems.length > 0 && visualizationSettingSection}
        </Stack>
      </FormContainer>
    </Stack>
  );
}
