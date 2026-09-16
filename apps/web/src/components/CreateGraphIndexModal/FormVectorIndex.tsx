import { Box, Grid, Tooltip, Typography, useTheme } from '@mui/material';
import { GraphEntityType, VectorTypePattern } from '@vesoft-inc/utils';
import { useTranslation } from 'react-i18next';
import {
  AutocompleteElement,
  FormContainer,
  SelectElement,
  TextFieldElement,
  UseFormReturn,
  useWatch,
} from 'react-hook-form-mui';
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { CloseFilled, DotsHexagon, EdgeType, ChevronRightFilled } from '@vesoft-inc/icons';
import type { GraphTypeElementOption } from './FormNormalIndex';
import { useTypesForNodesAndEdges } from './useTypesForNodesAndEdges';
import { GraphTypeElement } from '@studio/interfaces';

export interface CreateGraphVectorIndexFormValues {
  ifExists: boolean;
  indexName: string;
  on: GraphTypeElement & {
    propName: string;
    metrics: {
      DIM: number;
      METRIC: string;
      TYPE: string;
      NLIST: number | undefined;
      TRAINSIZE: number | undefined;
      MAX_DEGREE: number | undefined;
      EFCONSTRUCTION: number | undefined;
      CAPACITY: number | undefined;
    };
  };
}

interface FormForVectorIndexProps {
  form: UseFormReturn<CreateGraphVectorIndexFormValues>;
  entities: GraphTypeElementOption[];
}

const FormForVectorIndex = (props: FormForVectorIndexProps) => {
  const { form, entities } = props;
  const theme = useTheme();

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const { t } = useTranslation(['graph', 'common']);

  useEffect(() => {
    form.reset({
      ifExists: true,
      indexName: '',
      on: {
        metrics: {},
      },
    });
  }, [form]);

  const propertyOptions =
    useWatch({
      control: form.control,
      name: 'on.properties',
    }) || [];

  const fieldOn = useWatch({
    control: form.control,
    name: 'on',
  });
  useEffect(() => {
    form.setValue('on.propName', '');
  }, [fieldOn?.type_name]);

  const fieldType = useWatch({
    control: form.control,
    name: 'on.metrics.TYPE',
  });

  // Reset metrics fields when TYPE changes
  useEffect(() => {
    if (fieldType) {
      // Reset all metrics fields when TYPE changes
      form.setValue('on.metrics.NLIST', undefined);
      form.setValue('on.metrics.TRAINSIZE', undefined);
      form.setValue('on.metrics.MAX_DEGREE', undefined);
      form.setValue('on.metrics.EFCONSTRUCTION', undefined);
      form.setValue('on.metrics.CAPACITY', undefined);
    }
  }, [fieldType, form]);

  const { items: commonPropertyItems, setItems: setCommonPropertyItems } = useTypesForNodesAndEdges({
    graphTypeName: fieldOn?.graph_type_name,
    entities,
  });
  const vectorPropertyItems = commonPropertyItems.filter((item) => VectorTypePattern.exec(item.data_type));
  useEffect(() => {
    if (propertyOptions.length <= 0) {
      setCommonPropertyItems([]);
    }
  }, [propertyOptions.length]);

  const fieldPropName = useWatch({
    control: form.control,
    name: 'on.propName',
  });
  useEffect(() => {
    if (fieldPropName) {
      const item = vectorPropertyItems.find((item) => item.property_name === fieldPropName);
      if (item) {
        const [, dim] = VectorTypePattern.exec(item.data_type) || [];
        const dimValue = Number(dim);
        if (!Number.isNaN(dimValue)) {
          form.setValue('on.metrics.DIM', dimValue);
        }
      }
    }
  }, [fieldPropName, vectorPropertyItems, form]);

  return (
    <FormContainer formContext={form}>
      <Grid container rowSpacing={2} columnSpacing={1}>
        {/* Index Name */}
        <Grid size={{ md: 12 }}>
          <TextFieldElement
            size="small"
            label={t('indexName', { ns: 'graph' })}
            name="indexName"
            required
            fullWidth
            placeholder="Input"
          />
        </Grid>

        {/* ON Field */}
        <Grid size={{ md: 6 }}>
          <AutocompleteElement
            label="ON"
            name="on"
            required
            autocompleteProps={{
              fullWidth: true,
              autoSelect: true,
              size: 'small',
              handleHomeEndKeys: true,
              clearIcon: <CloseFilled fontSize="small" />,
              ChipProps: {
                size: 'small',
                sx: {
                  height: 22,
                  borderRadius: 2,
                },
              },
              renderOption: (props, option: GraphTypeElementOption) => (
                <Box component="li" {...props}>
                  {option.entity_type === GraphEntityType.Edge ? (
                    <EdgeType fontSize="medium" />
                  ) : (
                    <DotsHexagon fontSize="medium" />
                  )}
                  <Tooltip title={option.type_name} placement="top">
                    <Typography ml={2} noWrap>
                      {option.type_name}
                    </Typography>
                  </Tooltip>
                </Box>
              ),
              isOptionEqualToValue: (option: GraphTypeElementOption, value: GraphTypeElementOption | string | null) => {
                if (!option || !value || typeof value === 'string') {
                  return false;
                }
                return option.type_name === value.type_name;
              },
              getOptionLabel: (option) => {
                if (typeof option === 'string') {
                  return option;
                }
                return option?.type_name || '';
              },
            }}
            options={entities}
          />
        </Grid>

        {/* Prop Name Field */}
        <Grid size={{ md: 6 }}>
          <SelectElement
            label={t('propName')}
            name="on.propName"
            required
            fullWidth
            size="small"
            options={propertyOptions.map((property) => ({
              label: property,
              value: property,
              disabled: !vectorPropertyItems.some((item) => item.property_name === property),
            }))}
            labelKey="label"
            valueKey="value"
            disabled={propertyOptions.length === 0}
          />
        </Grid>

        {/* Advanced Settings Toggle */}
        <Grid size={{ md: 12 }}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="flex-start"
            sx={{
              cursor: 'pointer',
              color: theme.palette.vesoft.v2.primary3,
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <Typography variant="body2">{t('vectorIndex.advancedSettings')}</Typography>
            <ChevronRightFilled
              fontSize="small"
              sx={{
                ml: 1,
                transform: showAdvancedSettings ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease-in-out',
              }}
            />
          </Box>
        </Grid>

        {/* Advanced Settings Section */}
        {showAdvancedSettings && (
          <>
            {/* METRIC Field */}
            <Grid size={{ md: 6 }}>
              <SelectElement
                label={t('vectorIndex.metric')}
                name="on.metrics.METRIC"
                fullWidth
                size="small"
                options={[
                  { label: 'L2', value: 'L2' },
                  { label: 'IP', value: 'IP' },
                ]}
                labelKey="label"
                valueKey="value"
              />
            </Grid>

            {/* TYPE Field */}
            <Grid size={{ md: 6 }}>
              <SelectElement
                label={t('vectorIndex.type')}
                name="on.metrics.TYPE"
                fullWidth
                size="small"
                options={[
                  { label: 'HNSW', value: 'HNSW' },
                  { label: 'IVF', value: 'IVF' },
                ]}
                labelKey="label"
                valueKey="value"
              />
            </Grid>

            {/* TYPE === "IVF" */}
            {(!fieldType || fieldType === 'IVF') && (
              <>
                {/* NLIST Field */}
                <Grid size={{ md: 6 }}>
                  <TextFieldElement label="NLIST" name="on.metrics.NLIST" fullWidth size="small" type="number" />
                </Grid>

                {/* TRAINSIZE Field */}
                <Grid size={{ md: 6 }}>
                  <TextFieldElement
                    label="TRAINSIZE"
                    name="on.metrics.TRAINSIZE"
                    fullWidth
                    size="small"
                    type="number"
                  />
                </Grid>
              </>
            )}

            {/* TYPE === "HNSW" */}
            {fieldType === 'HNSW' && (
              <>
                {/* MAX_DEGREE Field */}
                <Grid size={{ md: 4 }}>
                  <TextFieldElement
                    label={t('vectorIndex.maxDegree')}
                    name="on.metrics.MAX_DEGREE"
                    fullWidth
                    size="small"
                    type="number"
                  />
                </Grid>

                {/* EFCONSTRUCTION Field */}
                <Grid size={{ md: 4 }}>
                  <TextFieldElement
                    label={t('vectorIndex.efConstruction')}
                    name="on.metrics.EFCONSTRUCTION"
                    fullWidth
                    size="small"
                    type="number"
                  />
                </Grid>

                {/* CAPACITY Field */}
                <Grid size={{ md: 4 }}>
                  <TextFieldElement
                    label={t('vectorIndex.capacity')}
                    name="on.metrics.CAPACITY"
                    fullWidth
                    size="small"
                    type="number"
                  />
                </Grid>
              </>
            )}
          </>
        )}
      </Grid>
    </FormContainer>
  );
};

export default observer(FormForVectorIndex);
