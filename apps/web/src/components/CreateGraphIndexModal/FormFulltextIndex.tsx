import { Box, Grid, Tooltip, Typography } from '@mui/material';
import { GraphEntityType, PropertyDataType } from '@vesoft-inc/utils';
import { useTranslation } from 'react-i18next';
import {
  AutocompleteElement,
  FormContainer,
  SelectElement,
  TextFieldElement,
  UseFormReturn,
  useWatch,
} from 'react-hook-form-mui';
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { CloseFilled, DotsHexagon, EdgeType } from '@vesoft-inc/icons';
import type { GraphTypeElementOption } from './FormNormalIndex';
import { useTypesForNodesAndEdges } from './useTypesForNodesAndEdges';
import { GraphTypeElement } from '@studio/interfaces';

export interface CreateGraphFulltextIndexFormValues {
  ifExists: boolean;
  indexName: string;
  on: GraphTypeElement & {
    propName: string;
  };
}

interface FormForFulltextIndexProps {
  form: UseFormReturn<CreateGraphFulltextIndexFormValues>;
  entities: GraphTypeElementOption[];
}

const FormForFulltextIndex = (props: FormForFulltextIndexProps) => {
  const { form, entities } = props;

  const { t } = useTranslation(['graph', 'common']);

  useEffect(() => {
    form.reset({
      ifExists: true,
      indexName: '',
      on: {},
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

  const { items: commonPropertyItems, setItems: setCommonPropertyItems } = useTypesForNodesAndEdges({
    graphTypeName: fieldOn?.graph_type_name,
    entities,
  });
  const fulltextPropertyItems = commonPropertyItems.filter((item) => item.data_type === PropertyDataType.STRING);
  useEffect(() => {
    if (propertyOptions.length <= 0) {
      setCommonPropertyItems([]);
    }
  }, [propertyOptions.length]);

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
        <Grid container size={{ md: 6 }} columnSpacing={2}>
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
              disabled: !fulltextPropertyItems.some((item) => item.property_name === property),
            }))}
            labelKey="label"
            valueKey="value"
            disabled={propertyOptions.length === 0}
          />
        </Grid>
      </Grid>
    </FormContainer>
  );
};

export default observer(FormForFulltextIndex);
