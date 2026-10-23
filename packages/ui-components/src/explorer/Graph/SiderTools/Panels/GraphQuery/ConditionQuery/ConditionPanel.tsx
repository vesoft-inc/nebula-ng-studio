import { Box, Typography } from '@mui/material';
import { SelectElement, TextFieldElement, useFormContext } from 'react-hook-form-mui';

import { IConditionQuery } from '../../../../../../graph/types/index';
import { useTranslation } from 'react-i18next';
import { SelectProps } from '../../../../../../graph/utils/helpers';

function ConditionPanel({ index }: { index: number }) {
  const form = useFormContext<IConditionQuery>();
  const { t } = useTranslation(['explorer']);
  return (
    <Box
      sx={{
        width: '100%',
        height: 200,
        borderRadius: 2,
        backgroundColor: (theme) => theme.palette.vesoft.bgColor2,
        border: (theme) => `1px solid ${theme.palette.vesoft.textColor5}`,
        padding: (theme) => `${theme.spacing(2)} ${theme.spacing(1.5)}`,
      }}
    >
      <Typography fontWeight="bold" textTransform="uppercase">
        {form.getValues(`conditions.${index}.prefix`)}
      </Typography>
      <SelectElement
        fullWidth
        name={`conditions.${index}.property`}
        options={[]}
        size="small"
        label={t('propertyName', { ns: 'explorer' })}
        sx={{
          mt: 1,
          background: (theme) => theme.palette.vesoft.background.paper,
        }}
        SelectProps={SelectProps}
      />
      <SelectElement
        fullWidth
        name={`conditions.${index}.operator`}
        options={[]}
        size="small"
        label={t('operator', { ns: 'explorer' })}
        sx={{
          mt: 1.5,
          background: (theme) => theme.palette.vesoft.background.paper,
        }}
        SelectProps={SelectProps}
      />
      <TextFieldElement
        size="small"
        name={`properties[${index}].value`}
        label={t('propertyValue', { ns: 'explorer' })}
        sx={{
          mt: 1.5,
          background: (theme) => theme.palette.vesoft.background.paper,
        }}
        fullWidth
      />
    </Box>
  );
}

export default ConditionPanel;
