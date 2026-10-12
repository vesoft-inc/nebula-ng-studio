import {
  Box,
  Button,
  // Collapse,
  Divider,
  Grid,
  IconButton,
  List,
  Popover,
  Stack,
  Typography,
  createFilterOptions,
  type FilterOptionsState,
  useTheme,
  type ListProps,
  Tooltip,
} from '@mui/material';
import {
  AutocompleteElement,
  TextFieldElement,
  useWatch,
  CheckboxElement,
  useFieldArray,
  useFormContext,
} from 'react-hook-form-mui';
import { Trans, useTranslation } from 'react-i18next';
import PopupState from 'material-ui-popup-state';
import { PropertyDataType } from '@vesoft-inc/utils';
import { usePopupState, bindFocus, bindPopover, bindTrigger } from 'material-ui-popup-state/hooks';
import { observer } from 'mobx-react-lite';
import { CloseFilled, AddFilled, MoreVertFilled, HelpCircleOutline } from '@vesoft-inc/icons';

import {
  TypeInfoContainer,
  PropertyBodyCell,
  PropertyHeaderCell,
} from '@studio/pages/SchemaManager/GraphTypeBuilder/styles';
import { GraphTypeBuildMode, INodeTypeItem, IProperty } from '@studio/interfaces';
import { DECIMAL_ACCURACY } from '@studio/utils/constant';
import { getDuplicateValues } from '@studio/utils';
import { useStore } from '@studio/stores';
import ColorPicker from '@studio/components/ColorPicker';
import { ColorBox } from '../VisualBuilder/styles';
import { useEffect } from 'react';

interface NodeTypeConfigFormProps {
  colorPicker?: boolean;
  slotProps?: {
    propertyList: ListProps;
  };
  onChange?: (values: INodeTypeItem) => void;
}

const itemTypeFilter = createFilterOptions<string>();
const labelOptionFilter = createFilterOptions<string>();

function NodeTypeConfigForm(props: NodeTypeConfigFormProps) {
  const { colorPicker, slotProps, onChange } = props;
  const form = useFormContext<INodeTypeItem>();
  const theme = useTheme();
  const { t } = useTranslation(['graphtype']);

  const defaultValues = form.formState.defaultValues;

  const { schemaStore, mode } = useStore().graphtypeStore;
  const readonly = mode === GraphTypeBuildMode.Readonly;
  const { fields, remove, append } = useFieldArray({
    control: form.control,
    name: 'properties',
  });

  const handleAddProperty = () => {
    append(
      new IProperty({
        name: '',
        type: PropertyDataType.STRING,
      })
    );
  };

  const handleDelete = (index: number) => () => {
    remove(index);
  };

  const name = useWatch({
    control: form.control,
    name: 'name',
    defaultValue: defaultValues?.name,
  });

  const selectedLabelOptions = useWatch({
    control: form.control,
    name: 'labels',
    defaultValue: (defaultValues?.labels || []).map((label) => label || ''),
  });

  const nodeStrokeColor = useWatch({
    control: form.control,
    name: 'style.strokeColor',
    defaultValue: defaultValues?.style?.strokeColor,
  });

  const properties = useWatch({
    control: form.control,
    name: 'properties',
    defaultValue: (defaultValues?.properties || []).map((item) => new IProperty(item)),
  });

  const labelOptions = [...new Set(Array.from(schemaStore?.nodeTypeLabeMap.keys() || []).concat(selectedLabelOptions))];

  const popupState = usePopupState({
    variant: 'popover',
    popupId: 'node-color-picker',
  });

  const targetId = form.formState.defaultValues?.id;
  useEffect(() => {
    if (!targetId) {
      return;
    }
    onChange?.(
      new INodeTypeItem({
        id: targetId,
        name,
        labels: selectedLabelOptions,
        style: {
          strokeColor: nodeStrokeColor,
        },
        properties,
      })
    );
  }, [targetId, name, nodeStrokeColor, properties, selectedLabelOptions, onChange]);

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <TypeInfoContainer>
        <Typography sx={{ mb: theme.spacing(2) }}>{t('nodeType', { ns: 'graphtype' })}</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 12 }}>
            <TextFieldElement
              size="small"
              label={t('nodeTypeName', { ns: 'graphtype' })}
              required
              name="name"
              fullWidth
              inputProps={{
                disabled: readonly,
              }}
            />
          </Grid>
          {colorPicker && (
            <Grid size={{ xs: 6, md: 12 }}>
              <Box {...bindFocus(popupState)} width="100%">
                <TextFieldElement
                  label={t('color', { ns: 'graphtype' })}
                  InputProps={{
                    startAdornment: <ColorBox sx={{ backgroundColor: nodeStrokeColor }} />,
                  }}
                  name="style.strokeColor"
                  size="small"
                  fullWidth
                  inputProps={{
                    disabled: readonly,
                  }}
                />
              </Box>
              <Popover
                {...bindPopover(popupState)}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                disablePortal
              >
                <ColorPicker
                  color={nodeStrokeColor}
                  onChangeComplete={(color) => {
                    form.setValue('style.strokeColor', color);
                    form.setValue('style.fill', `${color}60`);
                  }}
                />
              </Popover>
            </Grid>
          )}
          <Grid size={{ xs: 6, md: 12 }}>
            <AutocompleteElement
              name="labels"
              label={t('label', { ns: 'graphtype' })}
              multiple
              options={labelOptions}
              rules={{
                required: false,
                validate: (values: string[]) => {
                  const duplicateValues = getDuplicateValues(values || []);
                  return duplicateValues.length ? `Duplicate: ${duplicateValues.join(', ')}` : true;
                },
              }}
              textFieldProps={{
                inputProps: {
                  disabled: readonly,
                },
              }}
              autocompleteProps={{
                limitTags: 3,
                size: 'small',
                fullWidth: true,
                filterSelectedOptions: true,
                handleHomeEndKeys: true,
                freeSolo: true,
                autoSelect: true,
                blurOnSelect: true,
                disabled: readonly,
                clearIcon: <CloseFilled fontSize="small" />,
                ChipProps: {
                  size: 'small',
                  sx: {
                    height: 22,
                    borderRadius: 2,
                  },
                },
                sx: {
                  '& .MuiOutlinedInput-root': {
                    height: 'auto',
                  },
                },
                filterOptions: (options: string[], params: FilterOptionsState<string>) => {
                  const filtered = labelOptionFilter(options, params);
                  const { inputValue } = params;
                  // MUI has already removed selected labels from options.
                  const isExisting = labelOptions.includes(inputValue);
                  if (inputValue !== '' && !isExisting) {
                    filtered.push(inputValue);
                  }
                  return filtered;
                },
                disablePortal: true,
                componentsProps: {
                  popper: {
                    placement: 'top',
                  },
                },
                ListboxProps: {
                  sx: {
                    maxHeight: 240,
                  },
                },
              }}
            />
          </Grid>
        </Grid>
      </TypeInfoContainer>
      <Divider />
      <TypeInfoContainer>
        <Typography sx={{ mb: theme.spacing(2) }}>{t('properties', { ns: 'graphtype' })}</Typography>
        <Stack direction="row" sx={{ mt: 1 }}>
          <PropertyHeaderCell sx={{ flex: 0, flexBasis: '23%' }}>
            <Typography>{t('propName', { ns: 'graphtype' })}</Typography>
          </PropertyHeaderCell>
          <PropertyHeaderCell sx={{ flex: 1 }}>
            <Typography>{t('propType', { ns: 'graphtype' })}</Typography>
          </PropertyHeaderCell>
          <PropertyHeaderCell sx={{ flex: 0, flexBasis: '26%' }}>
            <Typography>{t('primaryKey', { ns: 'graphtype' })}</Typography>
          </PropertyHeaderCell>
        </Stack>
        <List {...slotProps?.propertyList}>
          {(fields || []).map((property, index) => (
            <Grid key={property.id || index} container direction="row">
              <Grid size={{ xs: 3 }}>
                <PropertyBodyCell>
                  <TextFieldElement
                    required
                    size="small"
                    fullWidth
                    label={t('propName', { ns: 'graphtype' })}
                    rules={{
                      required: 'Required',
                      validate: (value: string) => {
                        return fields.find((p, i) => i !== index && p.name === value) ? 'Duplicate' : true;
                      },
                    }}
                    disabled={readonly}
                    name={`properties.${index}.name`}
                  />
                </PropertyBodyCell>
              </Grid>
              <Grid size={{ xs: 6 }} direction="row" display="flex" id="fwafjawofj">
                <PropertyBodyCell>
                  <AutocompleteElement
                    name={`properties[${index}].type`}
                    label={t('propType', { ns: 'graphtype' })}
                    required
                    options={Object.values(PropertyDataType)}
                    textFieldProps={{
                      size: 'small',
                      fullWidth: true,
                      inputProps: {
                        disabled: readonly,
                      },
                    }}
                    autocompleteProps={{
                      disabled: readonly,
                      size: 'small',
                      fullWidth: true,
                      disableClearable: true,
                      freeSolo: false,
                      autoSelect: false,
                      blurOnSelect: true,
                      clearIcon: <CloseFilled fontSize="small" />,
                      disablePortal: true,
                      componentsProps: {
                        popper: {
                          placement: 'top',
                        },
                      },
                      ListboxProps: {
                        sx: {
                          maxHeight: 240,
                        },
                      },
                    }}
                  />
                </PropertyBodyCell>
                {(properties[index]?.type === PropertyDataType.LIST ||
                  properties[index]?.type === PropertyDataType.SET) && (
                  <PropertyBodyCell sx={{ flex: 1, paddingLeft: 0 }}>
                    <AutocompleteElement
                      name={`properties[${index}].itemType`}
                      label={t('itemType', { ns: 'graphtype' })}
                      required
                      options={[
                        ...Object.values(PropertyDataType).filter(
                          (item) =>
                            item !== PropertyDataType.DECIMAL &&
                            item !== PropertyDataType.SET &&
                            item !== PropertyDataType.MAP &&
                            item !== PropertyDataType.LIST &&
                            item !== PropertyDataType.VECTOR &&
                            item !== properties[index]?.itemType
                        ),
                        properties[index]?.itemType,
                      ].filter((item): item is PropertyDataType => Boolean(item))}
                      textFieldProps={{
                        size: 'small',
                        fullWidth: true,
                        inputProps: {
                          disabled: readonly,
                        },
                      }}
                      autocompleteProps={{
                        filterOptions: (options: string[], params: FilterOptionsState<string>) => {
                          const filtered = itemTypeFilter(options, params);
                          const { inputValue } = params;
                          const isExisting = options.some((option) => inputValue === option);
                          if (inputValue !== '' && !isExisting) {
                            filtered.push(inputValue);
                          }
                          return filtered;
                        },
                        disabled: readonly,
                        size: 'small',
                        fullWidth: true,
                        disableClearable: true,
                        freeSolo: true,
                        autoSelect: true,
                        blurOnSelect: true,
                        clearIcon: <CloseFilled fontSize="small" />,
                        disablePortal: true,
                        componentsProps: {
                          popper: {
                            placement: 'top',
                          },
                        },
                        ListboxProps: {
                          sx: {
                            maxHeight: 240,
                          },
                        },
                      }}
                    />
                  </PropertyBodyCell>
                )}
                {properties[index]?.type === PropertyDataType.MAP && (
                  <>
                    <PropertyBodyCell sx={{ flex: 1, paddingLeft: 0 }}>
                      <AutocompleteElement
                        name={`properties[${index}].keyType`}
                        label={t('keyType', { ns: 'graphtype' })}
                        required
                        options={[
                          ...Object.values(PropertyDataType).filter(
                            (item) =>
                              item !== PropertyDataType.DECIMAL &&
                              item !== PropertyDataType.SET &&
                              item !== PropertyDataType.MAP &&
                              item !== PropertyDataType.LIST &&
                              item !== PropertyDataType.VECTOR &&
                              item !== properties[index]?.keyType
                          ),
                          properties[index]?.keyType,
                        ].filter((item): item is PropertyDataType => Boolean(item))}
                        textFieldProps={{
                          size: 'small',
                          fullWidth: true,
                          inputProps: {
                            disabled: readonly,
                          },
                        }}
                        autocompleteProps={{
                          filterOptions: (options: string[], params: FilterOptionsState<string>) => {
                            const filtered = itemTypeFilter(options, params);
                            const { inputValue } = params;
                            const isExisting = options.some((option) => inputValue === option);
                            if (inputValue !== '' && !isExisting) {
                              filtered.push(inputValue);
                            }
                            return filtered;
                          },
                          disabled: readonly,
                          size: 'small',
                          fullWidth: true,
                          disableClearable: true,
                          freeSolo: true,
                          autoSelect: true,
                          blurOnSelect: true,
                          clearIcon: <CloseFilled fontSize="small" />,
                          disablePortal: true,
                          componentsProps: {
                            popper: {
                              placement: 'top',
                            },
                          },
                          ListboxProps: {
                            sx: {
                              maxHeight: 240,
                            },
                          },
                        }}
                      />
                    </PropertyBodyCell>
                    <PropertyBodyCell sx={{ flex: 1, paddingLeft: 0 }}>
                      <AutocompleteElement
                        name={`properties[${index}].valueType`}
                        label={t('valueType', { ns: 'graphtype' })}
                        required
                        options={[
                          ...Object.values(PropertyDataType).filter(
                            (item) =>
                              item !== PropertyDataType.DECIMAL &&
                              item !== PropertyDataType.SET &&
                              item !== PropertyDataType.MAP &&
                              item !== PropertyDataType.LIST &&
                              item !== PropertyDataType.VECTOR &&
                              item !== properties[index]?.valueType
                          ),
                          properties[index]?.valueType,
                        ].filter((item): item is PropertyDataType => Boolean(item))}
                        textFieldProps={{
                          size: 'small',
                          fullWidth: true,
                          inputProps: {
                            disabled: readonly,
                          },
                        }}
                        autocompleteProps={{
                          filterOptions: (options: string[], params: FilterOptionsState<string>) => {
                            const filtered = itemTypeFilter(options, params);
                            const { inputValue } = params;
                            const isExisting = options.some((option) => inputValue === option);
                            if (inputValue !== '' && !isExisting) {
                              filtered.push(inputValue);
                            }
                            return filtered;
                          },
                          disabled: readonly,
                          size: 'small',
                          fullWidth: true,
                          disableClearable: true,
                          freeSolo: true,
                          autoSelect: true,
                          blurOnSelect: true,
                          clearIcon: <CloseFilled fontSize="small" />,
                          disablePortal: true,
                          componentsProps: {
                            popper: {
                              placement: 'top',
                            },
                          },
                          ListboxProps: {
                            sx: {
                              maxHeight: 240,
                            },
                          },
                        }}
                      />
                    </PropertyBodyCell>
                  </>
                )}
                {properties[index]?.type === PropertyDataType.VECTOR && (
                  <PropertyBodyCell sx={{ flex: 1, paddingLeft: 0 }}>
                    <TextFieldElement
                      type="number"
                      label={t('dimensionCount', { ns: 'graphtype' })}
                      {...form.register(`properties.${index}.dimensionCount`, {
                        valueAsNumber: true,
                        min: 1,
                        max: 2147483647,
                      })}
                      required
                      size="small"
                      fullWidth
                      disabled={readonly}
                    />
                  </PropertyBodyCell>
                )}
              </Grid>
              <Grid size={{ xs: 3 }}>
                <PropertyBodyCell display="flex" justifyContent={'center'}>
                  <CheckboxElement
                    inputProps={{
                      disabled: readonly,
                    }}
                    size="small"
                    name={`properties[${index}].isPrimaryKey`}
                  />
                  <Box>
                    <PopupState variant="popper" popupId={`moreaction-${index}`}>
                      {(popupState) => (
                        <>
                          <IconButton size="small" {...bindTrigger(popupState)}>
                            <MoreVertFilled />
                          </IconButton>
                          <Popover
                            {...bindPopover(popupState)}
                            anchorOrigin={{
                              vertical: 'top',
                              horizontal: 'left',
                            }}
                            transformOrigin={{
                              vertical: 148 + 12,
                              horizontal: 288,
                            }}
                            disablePortal
                          >
                            <Box
                              minWidth={288}
                              height={148}
                              padding={(theme) => `${theme.spacing(2)} ${theme.spacing(3)}`}
                            >
                              <Stack direction="row" sx={{ mt: 1 }}>
                                {/* <PropertyHeaderCell>
                                  <Typography>{t('isList', { ns: 'graphtype' })}</Typography>
                                </PropertyHeaderCell> */}
                                {properties[index]?.type === PropertyDataType.DECIMAL && (
                                  <PropertyHeaderCell>
                                    <Typography>{t('decimalPrecision', { ns: 'graphtype' })}</Typography>
                                    <Tooltip
                                      placement="top"
                                      arrow
                                      title={
                                        <Trans
                                          i18nKey="decimalPrecisionRange"
                                          values={{ DECIMAL_ACCURACY }}
                                          t={t}
                                          ns={'graphtype'}
                                        />
                                      }
                                    >
                                      <HelpCircleOutline sx={{ ml: 1 }} fontSize="small" />
                                    </Tooltip>
                                  </PropertyHeaderCell>
                                )}
                                {properties[index]?.type === PropertyDataType.DECIMAL && (
                                  <PropertyHeaderCell>
                                    <Typography>{t('decimalScale', { ns: 'graphtype' })}</Typography>
                                    <Tooltip
                                      placement="top"
                                      arrow
                                      title={
                                        <Trans
                                          i18nKey="decimalScaleRange"
                                          values={{ DECIMAL_ACCURACY }}
                                          t={t}
                                          ns={'graphtype'}
                                        />
                                      }
                                    >
                                      <HelpCircleOutline sx={{ ml: 1 }} fontSize="small" />
                                    </Tooltip>
                                  </PropertyHeaderCell>
                                )}
                                <PropertyHeaderCell>
                                  <Typography>Nullable</Typography>
                                </PropertyHeaderCell>
                                <PropertyHeaderCell>
                                  <Typography>{t('defaultValue', { ns: 'graphtype' })}</Typography>
                                </PropertyHeaderCell>
                              </Stack>
                              <Stack direction="row" sx={{ mt: 1 }}>
                                {/* <PropertyBodyCell>
                                  <CheckboxElement
                                    name={`properties[${index}].isList`}
                                    inputProps={{
                                      disabled: readonly,
                                    }}
                                  />
                                </PropertyBodyCell> */}
                                {properties[index]?.type === PropertyDataType.DECIMAL && (
                                  <PropertyBodyCell width={100}>
                                    <TextFieldElement
                                      size="small"
                                      name={`properties[${index}].decimalPrecision`}
                                      inputProps={{
                                        disabled: readonly,
                                        inputMode: 'numeric',
                                        pattern: '[0-9]*',
                                      }}
                                      onChange={() => {
                                        form.trigger('properties');
                                      }}
                                      fullWidth
                                      rules={{
                                        validate: (value) => {
                                          if (value && (Number(value) < 1 || Number(value) > DECIMAL_ACCURACY)) {
                                            return false;
                                          }
                                          return true;
                                        },
                                      }}
                                      type="number"
                                    />
                                  </PropertyBodyCell>
                                )}
                                {properties[index]?.type === PropertyDataType.DECIMAL && (
                                  <PropertyBodyCell width={100}>
                                    <TextFieldElement
                                      size="small"
                                      name={`properties[${index}].decimalScale`}
                                      inputProps={{
                                        disabled: readonly,
                                        inputMode: 'numeric',
                                        pattern: '[0-9]*',
                                      }}
                                      onChange={() => {
                                        form.trigger('properties');
                                      }}
                                      rules={{
                                        validate: (value) => {
                                          const MValue = form.getValues(`properties.${index}.decimalPrecision`);
                                          if (!MValue) return false;
                                          if (
                                            value &&
                                            (Number(value) < 1 ||
                                              Number(value) > DECIMAL_ACCURACY ||
                                              Number(value) > Number(MValue))
                                          ) {
                                            return false;
                                          }
                                          return true;
                                        },
                                      }}
                                      type="number"
                                    />
                                  </PropertyBodyCell>
                                )}
                                <PropertyBodyCell>
                                  <CheckboxElement
                                    name={`properties[${index}].nullable`}
                                    inputProps={{
                                      disabled: readonly,
                                    }}
                                  />
                                </PropertyBodyCell>
                                <PropertyBodyCell>
                                  <TextFieldElement
                                    size="small"
                                    name={`properties[${index}].default`}
                                    inputProps={{
                                      disabled: readonly,
                                    }}
                                  />
                                </PropertyBodyCell>
                              </Stack>
                            </Box>
                          </Popover>
                        </>
                      )}
                    </PopupState>

                    {!readonly && (
                      <IconButton size="small" onClick={handleDelete(index)}>
                        <CloseFilled />
                      </IconButton>
                    )}
                  </Box>
                </PropertyBodyCell>
              </Grid>
            </Grid>
          ))}
          <PropertyBodyCell sx={{ mb: 1 }}>
            {!readonly && (
              <Box width="100%" justifyContent="center" display="flex">
                <Button
                  onClick={handleAddProperty}
                  variant="text"
                  startIcon={<AddFilled fontSize="medium" />}
                  sx={{
                    '&.MuiButton-root': {
                      textDecoration: 'none',
                    },
                  }}
                >
                  {t('addProperty', { ns: 'graphtype' })}
                </Button>
              </Box>
            )}
          </PropertyBodyCell>
        </List>
      </TypeInfoContainer>
    </Box>
  );
}

export default observer(NodeTypeConfigForm);
