import { Button, Grid, IconButton, List, MenuItem, Stack, Tooltip, Typography, styled } from '@mui/material';
import {
  GeographyTypePattern,
  GraphEntityType,
  ListTypePattern,
  MapTypePattern,
  SetTypePattern,
  SortType,
  VectorTypePattern,
} from '@vesoft-inc/utils';
import { Box, useTheme } from '@mui/material';
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
import { GraphTypeElement } from '@studio/interfaces';
import { observer } from 'mobx-react-lite';
import { AddFilled, CloseFilled, DotsHexagon, EdgeType } from '@vesoft-inc/icons';
import { useTypesForNodesAndEdges } from './useTypesForNodesAndEdges';

export interface CreateGraphIndexFormValues {
  ifExists: boolean;
  indexName: string;
  on: GraphTypeElement & {
    indexProperties: {
      name: string;
      sort: SortType;
    }[];
  };
}

export type GraphTypeElementOption = GraphTypeElement & {
  graph_name: string;
  graph_type_name: string;
};

interface CreateGraphIndexModalProps {
  form: UseFormReturn<CreateGraphIndexFormValues>;
  entities: GraphTypeElementOption[];
}

const PropertyHeaderCell = styled(Box)`
  background-color: ${({ theme }) => theme.palette.vesoft.bgColor2};
  padding: ${({ theme }) => theme.spacing(1)};
  padding-left: ${({ theme }) => theme.spacing(3)};
  text-align: center;
  flex: 1;
  position: relative;
  &:before {
    content: '';
    width: 2px;
    background-color: ${({ theme }) => theme.palette.vesoft.textColor6};
    height: 50%;
    position: absolute;
    top: 25%;
    left: ${({ theme }) => theme.spacing(1)};
  }
`;

const CreateGraphIndexModal = (props: CreateGraphIndexModalProps) => {
  const { form, entities } = props;
  const theme = useTheme();
  const { t } = useTranslation(['graph', 'common']);

  const handleAddIndexProperty = () => {
    form.setValue(
      'on.indexProperties',
      (indexProperties || []).concat([
        {
          name: '',
          sort: SortType.ASC,
        },
      ])
    );
  };

  useEffect(() => {
    form.reset({
      ifExists: true,
      indexName: '',
      on: {
        type_name: '',
        indexProperties: [],
      },
    });
  }, [form]);

  const indexProperties = useWatch({
    control: form.control,
    name: 'on.indexProperties',
  });

  const propertyOptions = useWatch({
    control: form.control,
    name: 'on.properties',
  });

  const handleDeleteIndexProperty = (index: number) => () => {
    form.setValue(
      'on.indexProperties',
      (indexProperties || []).filter((_, i) => i !== index)
    );
  };

  const fieldOn = useWatch({
    control: form.control,
    name: 'on',
  });

  const { items: commonPropertyItems, setItems: setCommonPropertyItems } = useTypesForNodesAndEdges({
    graphTypeName: fieldOn?.graph_type_name,
    entities,
  });
  const normalPropertyItems = commonPropertyItems.filter(
    (item) =>
      !(
        VectorTypePattern.exec(item.data_type) ||
        GeographyTypePattern.exec(item.data_type) ||
        ListTypePattern.exec(item.data_type) ||
        SetTypePattern.exec(item.data_type) ||
        MapTypePattern.exec(item.data_type)
      )
  );
  useEffect(() => {
    if (propertyOptions?.length <= 0) {
      setCommonPropertyItems([]);
    }
  }, [propertyOptions]);

  return (
    <FormContainer formContext={form}>
      <Grid container rowSpacing={2}>
        <Grid size={{ md: 12 }}>
          <TextFieldElement size="small" label={t('indexName', { ns: 'graph' })} name="indexName" required fullWidth />
        </Grid>
        <Grid size={{ md: 12 }}>
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
                <MenuItem {...props}>
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
                </MenuItem>
              ),
              isOptionEqualToValue: (option: GraphTypeElementOption, value: GraphTypeElementOption) =>
                value && option.type_name === value?.type_name,
              getOptionLabel: (option) => {
                if (typeof option === 'string') {
                  return option;
                }
                return option.type_name;
              },
            }}
            options={entities}
          />
        </Grid>
        {propertyOptions && (
          <Grid size={{ md: 12 }} rowSpacing={2}>
            <Typography sx={{ mb: theme.spacing(2) }}>{t('indexProperties', { ns: 'graph' })}</Typography>
            <Stack direction="row" sx={{ mt: 1 }}>
              <PropertyHeaderCell>
                <Typography>{t('propName', { ns: 'graph' })}</Typography>
              </PropertyHeaderCell>
              <PropertyHeaderCell>
                <Typography>{t('sort', { ns: 'graph' })}</Typography>
              </PropertyHeaderCell>
            </Stack>
            <List>
              {indexProperties?.map((_, index) => (
                <Grid key={index} container direction="row" alignItems="center" columnSpacing={2} mt={2}>
                  <Grid size={{ xs: 6 }} rowSpacing={2}>
                    <SelectElement
                      name={`on.indexProperties.${index}.name`}
                      required
                      fullWidth
                      size="small"
                      options={propertyOptions.map((property) => ({
                        label: property,
                        disabled: !normalPropertyItems.some((item) => item.property_name === property),
                      }))}
                      labelKey="label"
                      valueKey="label"
                    />
                  </Grid>
                  <Grid size={{ xs: 5 }} rowSpacing={2}>
                    <SelectElement
                      name={`on.indexProperties.${index}.sort`}
                      required
                      fullWidth
                      size="small"
                      options={[
                        {
                          name: SortType.ASC,
                        },
                        {
                          name: SortType.DESC,
                        },
                      ]}
                      labelKey="name"
                      valueKey="name"
                    />
                  </Grid>
                  <Grid size={{ xs: 1 }} rowSpacing={2}>
                    <IconButton size="small" onClick={handleDeleteIndexProperty(index)}>
                      <CloseFilled />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Box width="100%" justifyContent="center" display="flex" mt={2}>
                <Button onClick={handleAddIndexProperty} variant="text" startIcon={<AddFilled fontSize="medium" />}>
                  {t('addProperty', { ns: 'graphtype' })}
                </Button>
              </Box>
            </List>
          </Grid>
        )}
      </Grid>
    </FormContainer>
  );
};

export default observer(CreateGraphIndexModal);
