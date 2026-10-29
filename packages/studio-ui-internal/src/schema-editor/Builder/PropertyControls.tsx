import { Checkbox, TextField } from '@mui/material';
import { useController, useFormContext, type FieldPath } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';
import { DECIMAL_MAX_PRECISION, DECIMAL_MAX_SCALE, getDecimalParameterError } from '@vesoft-inc/studio-core/graph';
import { PropertyDataType } from '@vesoft-inc/studio-core/contracts';
import { INodeTypeItem } from '../../schema/types';
import { PropertyBodyCell } from './styles';

// Disable the view, not RHF's controller: immutable values must remain in submissions.
export function PropertyCheckbox({
  name,
  disabled,
  label,
}: {
  name: FieldPath<INodeTypeItem>;
  disabled: boolean;
  label?: string;
}) {
  const { field } = useController<INodeTypeItem>({ name });
  return (
    <Checkbox
      checked={!!field.value}
      onChange={(_, checked) => field.onChange(checked)}
      onBlur={field.onBlur}
      inputRef={field.ref}
      name={field.name}
      disabled={disabled}
      size="small"
      inputProps={{ 'aria-label': label }}
    />
  );
}

export function DecimalFields({ index, disabled }: { index: number; disabled: boolean }) {
  return (
    <>
      <DecimalField index={index} parameter="decimalPrecision" disabled={disabled} />
      <DecimalField index={index} parameter="decimalScale" disabled={disabled} />
    </>
  );
}

function DecimalField({
  index,
  parameter,
  disabled,
}: {
  index: number;
  parameter: 'decimalPrecision' | 'decimalScale';
  disabled: boolean;
}) {
  const { t } = useTranslation('graphtype');
  const form = useFormContext<INodeTypeItem>();
  const precision = parameter === 'decimalPrecision';
  const other = precision ? 'decimalScale' : 'decimalPrecision';
  const { field, fieldState } = useController<INodeTypeItem>({
    name: `properties.${index}.${parameter}`,
    rules: {
      deps: [`properties.${index}.${other}`],
      validate: (_, values) => {
        const property = values.properties[index];
        if (!property || property.type !== PropertyDataType.DECIMAL) return true;
        const error = getDecimalParameterError(property);
        return (
          error !== (precision ? 'precision' : 'scale') ||
          t(precision ? 'decimalPrecisionRange' : 'decimalScaleRange', {
            max: precision ? DECIMAL_MAX_PRECISION : DECIMAL_MAX_SCALE,
          })
        );
      },
    },
  });
  return (
    <PropertyBodyCell sx={{ minWidth: 100, alignItems: 'flex-start' }}>
      <TextField
        size="small"
        type="number"
        fullWidth
        disabled={disabled}
        value={field.value ?? ''}
        name={field.name}
        inputRef={field.ref}
        onBlur={field.onBlur}
        onChange={(event) => {
          field.onChange(event.target.value);
          void form.trigger([`properties.${index}.decimalPrecision`, `properties.${index}.decimalScale`]);
        }}
        inputProps={{
          'aria-label': t(parameter),
          min: precision ? 1 : 0,
          max: precision ? DECIMAL_MAX_PRECISION : DECIMAL_MAX_SCALE,
          step: 1,
        }}
        error={!!fieldState.error}
        helperText={fieldState.error?.message}
      />
    </PropertyBodyCell>
  );
}
