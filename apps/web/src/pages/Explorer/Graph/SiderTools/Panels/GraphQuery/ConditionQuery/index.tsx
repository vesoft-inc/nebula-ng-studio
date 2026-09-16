import { observer } from 'mobx-react-lite';
import { Box, Button, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { IconButton, Typography } from '@mui/material';
import { AutocompleteElement, FormContainer, SelectElement, useFieldArray, useForm } from 'react-hook-form-mui';
import { ArrowBackFilled, CloseFilled } from '@vesoft-inc/icons';
import { useMemo } from 'react';

import { useStore } from '@studio/stores';
import { IConditionQuery, SiderPanel } from '@studio/interfaces/explorer/explorer';
import { QueryTitle } from '../styles';
import ConditionPanel from './ConditionPanel';
import { SelectProps } from '@studio/utils/graph/helpers';

export default observer(function ConditionQuery() {
  const {
    explorerStore: { graphWorkspace },
  } = useStore();
  const { t } = useTranslation(['explorer']);
  const form = useForm<IConditionQuery>({
    defaultValues: {
      conditions: [
        {
          prefix: 'WHERE',
        },
      ],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'conditions',
  });

  const entityTypeOptions = useMemo(() => {
    const { graphTypeDetails = [] } = graphWorkspace;
    return graphTypeDetails.map((item) => ({
      label: item.type_name,
      value: item.type_name,
    }));
  }, [graphWorkspace.graphTypeDetails]);

  const entityLabelOptions = useMemo(() => {
    const { graphTypeDetails = [] } = graphWorkspace;
    const labelsSet = graphTypeDetails.reduce((acc, item) => {
      item.labels.forEach((label) => {
        acc.add(label);
      });
      return acc;
    }, new Set<string>());
    return Array.from(labelsSet);
  }, [graphWorkspace.graphTypeDetails]);

  return (
    <Box display="flex" flexDirection="column" height="100%">
      <Typography
        fontWeight={500}
        sx={{ color: (theme) => theme.palette.vesoft.textColor1 }}
        flex={0}
        display="flex"
        alignItems="center"
      >
        <IconButton
          onClick={() => {
            graphWorkspace.updateActiveSiderKey(SiderPanel.GraphQuery);
          }}
        >
          <ArrowBackFilled />
        </IconButton>{' '}
        {t('conditionalQuery', { ns: 'explorer' })}
      </Typography>
      <Divider />
      <QueryTitle my={2}>{t('type', { ns: 'explorer' })}</QueryTitle>
      <FormContainer formContext={form}>
        <SelectElement
          label={t('conditionTypeQueryTitle', { ns: 'explorer' })}
          name="typeName"
          fullWidth
          size="small"
          options={entityTypeOptions}
          labelKey="label"
          valueKey="value"
          SelectProps={SelectProps}
        />
        <AutocompleteElement
          label={t('conditionLabelQueryTitle', { ns: 'explorer' })}
          name="label"
          options={entityLabelOptions}
          multiple
          autocompleteProps={{
            sx: { mt: 1.5 },
            limitTags: 2,
            size: 'small',
            fullWidth: true,
            clearIcon: <CloseFilled fontSize="small" />,
            isOptionEqualToValue: (option, value) => option === value,
            ChipProps: {
              size: 'small',
              sx: {
                height: 22,
                borderRadius: 2,
              },
            },
            handleHomeEndKeys: true,
          }}
        />
        <QueryTitle my={2}>{t('condition', { ns: 'explorer' })}</QueryTitle>
        {fields.map((_, index) => (
          <ConditionPanel key={index} index={index} />
        ))}
      </FormContainer>
      <Box flex={1} display="flex" flexDirection="column" justifyContent="flex-end">
        <Button variant="contained" fullWidth onClick={() => {}}>
          {t('query', { ns: 'explorer' })}
        </Button>
      </Box>
    </Box>
  );
});
