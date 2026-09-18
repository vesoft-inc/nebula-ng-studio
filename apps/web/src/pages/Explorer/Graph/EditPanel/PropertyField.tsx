import { Box, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SelectElement, TextFieldElement } from 'react-hook-form-mui';
import { GraphEntityType, PropertyDataType } from '@vesoft-inc/utils';
import { isIntegerPropertyType, type PropertyMeta } from '@studio/utils/graph/base/dml';

const badgeSx = {
  height: 16,
  fontSize: 10,
  ml: 0.5,
  '& .MuiChip-label': { px: 0.5 },
} as const;

export const PropertyLabel = ({ property, entityType }: { property: PropertyMeta; entityType: GraphEntityType }) => {
  const { t } = useTranslation(['explorer']);
  const keyLabel =
    entityType === GraphEntityType.Node ? t('primaryKey', { ns: 'explorer' }) : t('multiEdgeKey', { ns: 'explorer' });
  return (
    <Box component="span" display="flex" alignItems="center" flexWrap="wrap">
      {property.property_name}
      {!property.nullable && <Chip size="small" color="warning" variant="outlined" label="NOT NULL" sx={badgeSx} />}
      {property.isKey && <Chip size="small" color="primary" variant="outlined" label={keyLabel} sx={badgeSx} />}
    </Box>
  );
};

type PropertyFieldProps = {
  property: PropertyMeta;
  entityType: GraphEntityType;
  disabled?: boolean;
};

const TIMESTAMP_FIELD_TYPES: Partial<Record<PropertyDataType, { type: string; step?: number }>> = {
  [PropertyDataType.DATE]: { type: 'date' },
  [PropertyDataType.LOCAL_TIME]: { type: 'time', step: 1 },
  [PropertyDataType.ZONED_TIME]: { type: 'time', step: 1 },
  [PropertyDataType.LOCAL_DATETIME]: { type: 'datetime-local', step: 1 },
  [PropertyDataType.ZONED_DATETIME]: { type: 'datetime-local', step: 1 },
};

/**
 * Schema driven property input.
 *
 * NOT NULL (`nullable === false`) properties are required; nullable ones can be cleared to
 * store NULL. Types the UI cannot model are entered as raw GQL literals.
 */
export const PropertyField = ({ property, entityType, disabled }: PropertyFieldProps) => {
  const { t } = useTranslation(['explorer']);
  const name = property.property_name;
  const label = <PropertyLabel property={property} entityType={entityType} />;
  const rules = {
    required: {
      value: !property.nullable,
      message: t('validation.required', { ns: 'explorer' }),
    },
  };
  const timestampField = TIMESTAMP_FIELD_TYPES[property.data_type];

  if (property.data_type === PropertyDataType.BOOL) {
    const options = [
      ...(property.nullable ? [{ id: '', label: t('nullOption', { ns: 'explorer' }) }] : []),
      { id: 'true', label: 'true' },
      { id: 'false', label: 'false' },
    ];
    return (
      <SelectElement
        name={name}
        label={label}
        disabled={disabled}
        fullWidth
        size="small"
        required={!property.nullable}
        options={options}
        rules={rules}
      />
    );
  }

  return (
    <TextFieldElement
      name={name}
      label={label}
      disabled={disabled}
      fullWidth
      size="small"
      required={!property.nullable}
      rules={rules}
      helperText={property.nullable ? t('nullableTip', { ns: 'explorer' }) : undefined}
      type={timestampField?.type}
      slotProps={{
        inputLabel: timestampField ? { shrink: true } : undefined,
        htmlInput: {
          step: timestampField?.step,
          inputMode: isIntegerPropertyType(property.data_type) ? 'numeric' : 'decimal',
        },
      }}
    />
  );
};

export default PropertyField;
