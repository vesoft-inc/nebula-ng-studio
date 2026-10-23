import {
  Box,
  Button,
  Grid,
  IconButton,
  List,
  MenuItem,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  styled,
} from '@mui/material';
import {
  EdgeDirectionType,
  GeographyTypePattern,
  GraphEntityType,
  ListTypePattern,
  SortType,
  VectorTypePattern,
} from '@vesoft-inc/utils';
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
import { AddFilled, CloseFilled, EdgeType } from '@vesoft-inc/icons';
import type { GraphTypeElementOption } from './FormNormalIndex';
import { useTypesForNodesAndEdges } from './useTypesForNodesAndEdges';
import { GraphTypeElement } from '../types';
import { extractEdgeByEdgeTypeName } from '../../shared/utilities';

export interface CreateGraphVertexCentricIndexFormValues {
  ifExists: boolean;
  indexName: string;
  on: GraphTypeElement & {
    anchor: '_src' | '_dst';
    indexProperties: {
      name: string;
      sort: SortType;
    }[];
  };
}

interface FormVertexCentricIndexProps {
  form: UseFormReturn<CreateGraphVertexCentricIndexFormValues>;
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

const getEdgeSupportInfo = (edge?: Partial<GraphTypeElementOption>) => {
  if (!edge?.type_pattern) {
    return {
      supported: false,
      reason: 'parse' as const,
      srcNodeName: '',
      dstNodeName: '',
    };
  }
  const info = extractEdgeByEdgeTypeName(edge.type_pattern);
  if (!info) {
    return {
      supported: false,
      reason: 'parse' as const,
      srcNodeName: '',
      dstNodeName: '',
    };
  }
  if (info.direction === EdgeDirectionType.Undirected) {
    return {
      supported: false,
      reason: 'undirected' as const,
      srcNodeName: '',
      dstNodeName: '',
    };
  }
  if (info.direction === EdgeDirectionType.Backward) {
    return {
      supported: true,
      srcNodeName: info.dstNodeName,
      dstNodeName: info.fromNodeName,
    };
  }
  return {
    supported: true,
    srcNodeName: info.fromNodeName,
    dstNodeName: info.dstNodeName,
  };
};

const formatEndpointLabel = ({
  endpointRole,
  nodeName,
  fallback,
}: {
  endpointRole: string;
  nodeName?: string;
  fallback: string;
}) => {
  if (!nodeName) {
    return fallback;
  }
  return `${endpointRole}: ${nodeName}`;
};

const FormVertexCentricIndex = ({ form, entities }: FormVertexCentricIndexProps) => {
  const { t } = useTranslation(['graph', 'common']);

  useEffect(() => {
    form.reset({
      ifExists: true,
      indexName: '',
      on: {
        anchor: '_src',
        indexProperties: [],
      } as unknown as CreateGraphVertexCentricIndexFormValues['on'],
    });
  }, [form]);

  const edgeEntities = entities.filter((item) => item.entity_type === GraphEntityType.Edge);

  const indexProperties =
    useWatch({
      control: form.control,
      name: 'on.indexProperties',
    }) || [];

  const propertyOptions =
    useWatch({
      control: form.control,
      name: 'on.properties',
    }) || [];

  const fieldOn = useWatch({
    control: form.control,
    name: 'on',
  });
  const anchor =
    useWatch({
      control: form.control,
      name: 'on.anchor',
    }) || '_src';

  useEffect(() => {
    form.setValue('on.anchor', '_src');
    form.setValue('on.indexProperties', []);
  }, [fieldOn?.graph_type_name, fieldOn?.entity_type, fieldOn?.type_name, form]);

  const { items: commonPropertyItems } = useTypesForNodesAndEdges({
    graphTypeName: fieldOn?.graph_type_name,
    typeName: fieldOn?.type_name,
    entityType: fieldOn?.entity_type,
  });

  const normalPropertyItems = commonPropertyItems.filter(
    (item) =>
      !(
        VectorTypePattern.exec(item.data_type) ||
        GeographyTypePattern.exec(item.data_type) ||
        ListTypePattern.exec(item.data_type)
      )
  );

  const selectedEdgeSupport = getEdgeSupportInfo(fieldOn);
  const isAnchorSelectable = Boolean(fieldOn?.type_name && selectedEdgeSupport.supported);

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

  const handleDeleteIndexProperty = (index: number) => () => {
    form.setValue(
      'on.indexProperties',
      (indexProperties || []).filter((_, i) => i !== index)
    );
  };

  const sourceEndpointText = t('vertexCentricIndex.sourceEndpoint', { ns: 'graph' });
  const targetEndpointText = t('vertexCentricIndex.targetEndpoint', { ns: 'graph' });
  const sourceEndpointLabel = formatEndpointLabel({
    endpointRole: sourceEndpointText,
    nodeName: selectedEdgeSupport.srcNodeName,
    fallback: sourceEndpointText,
  });
  const targetEndpointLabel = formatEndpointLabel({
    endpointRole: targetEndpointText,
    nodeName: selectedEdgeSupport.dstNodeName,
    fallback: targetEndpointText,
  });

  return (
    <FormContainer formContext={form}>
      <Grid container rowSpacing={2} columnSpacing={1}>
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
              getOptionDisabled: (option: GraphTypeElementOption) => !getEdgeSupportInfo(option).supported,
              renderOption: ({ key, ...props }, option: GraphTypeElementOption) => {
                const supportInfo = getEdgeSupportInfo(option);
                const helperText = !supportInfo.supported
                  ? supportInfo.reason === 'undirected'
                    ? t('vertexCentricIndex.undirectedEdgeNotSupported', { ns: 'graph' })
                    : t('vertexCentricIndex.directionParseNotSupported', { ns: 'graph' })
                  : null;
                return (
                  <MenuItem key={key} {...props} disabled={!supportInfo.supported}>
                    <EdgeType fontSize="medium" />
                    <Box ml={2} minWidth={0}>
                      <Tooltip title={option.type_name} placement="top">
                        <Typography noWrap>{option.type_name}</Typography>
                      </Tooltip>
                      {helperText && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {helperText}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                );
              },
              getOptionKey: (option) =>
                typeof option === 'string'
                  ? option
                  : `${option.graph_type_name}:${option.entity_type}:${option.type_name}`,
              isOptionEqualToValue: (option: GraphTypeElementOption, value: GraphTypeElementOption | string | null) => {
                if (!option || !value || typeof value === 'string') {
                  return false;
                }
                return (
                  option.type_name === value.type_name &&
                  option.entity_type === value.entity_type &&
                  option.graph_type_name === value.graph_type_name
                );
              },
              getOptionLabel: (option) => {
                if (typeof option === 'string') {
                  return option;
                }
                return option?.type_name || '';
              },
            }}
            options={edgeEntities}
          />
          <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
            {t('vertexCentricIndex.onlyEdgeSupported', { ns: 'graph' })}
          </Typography>
        </Grid>

        <Grid size={{ md: 12 }}>
          <Typography sx={{ mb: 1 }}>{t('vertexCentricIndex.anchorSelector', { ns: 'graph' })}</Typography>
          <ToggleButtonGroup
            value={anchor}
            exclusive
            onChange={(_e, value: '_src' | '_dst' | null) => {
              if (value !== null) {
                form.setValue('on.anchor', value);
              }
            }}
            disabled={!isAnchorSelectable}
            fullWidth
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                py: 1,
                '&.Mui-selected': {
                  backgroundColor: (theme) => theme.palette.vesoft.bgColor2,
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: (theme) => theme.palette.vesoft.bgColor2,
                  },
                },
              },
            }}
          >
            <ToggleButton value="_src">
              <Typography noWrap>{sourceEndpointLabel}</Typography>
            </ToggleButton>
            <ToggleButton value="_dst">
              <Typography noWrap>{targetEndpointLabel}</Typography>
            </ToggleButton>
          </ToggleButtonGroup>
          {fieldOn?.type_name && !selectedEdgeSupport.supported && (
            <Typography variant="caption" color="error" mt={0.5} display="block">
              {selectedEdgeSupport.reason === 'undirected'
                ? t('vertexCentricIndex.undirectedEdgeNotSupported', { ns: 'graph' })
                : t('vertexCentricIndex.directionParseNotSupported', { ns: 'graph' })}
            </Typography>
          )}
        </Grid>

        <Grid size={{ md: 12 }}>
          <Typography sx={{ mb: 2 }}>{t('indexProperties', { ns: 'graph' })}</Typography>
          <Stack direction="row" sx={{ mt: 1 }}>
            <PropertyHeaderCell>
              <Typography>{t('propName', { ns: 'graph' })}</Typography>
            </PropertyHeaderCell>
            <PropertyHeaderCell>
              <Typography>{t('sort', { ns: 'graph' })}</Typography>
            </PropertyHeaderCell>
          </Stack>
          <List>
            {indexProperties.map((_, index) => (
              <Grid key={index} container direction="row" alignItems="center" columnSpacing={2} mt={2}>
                <Grid size={{ xs: 6 }}>
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
                <Grid size={{ xs: 5 }}>
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
                <Grid size={{ xs: 1 }}>
                  <IconButton size="small" onClick={handleDeleteIndexProperty(index)}>
                    <CloseFilled />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Box width="100%" justifyContent="center" display="flex" mt={2}>
              <Button
                onClick={handleAddIndexProperty}
                variant="text"
                startIcon={<AddFilled fontSize="medium" />}
                disabled={!fieldOn?.type_name}
              >
                {t('addProperty', { ns: 'graphtype' })}
              </Button>
            </Box>
          </List>
        </Grid>
      </Grid>
    </FormContainer>
  );
};

export default observer(FormVertexCentricIndex);
