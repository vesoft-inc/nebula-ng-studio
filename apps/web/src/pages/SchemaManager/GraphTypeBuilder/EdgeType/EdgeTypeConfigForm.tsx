import { useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Divider,
  Grid,
  IconButton,
  List,
  MenuItem,
  Stack,
  Typography,
  createFilterOptions,
  type FilterOptionsState,
  Popover,
  useTheme,
  type ListProps,
  Tooltip,
} from '@mui/material';
import {
  AutocompleteElement,
  TextFieldElement,
  SelectElement,
  useWatch,
  CheckboxElement,
  useFormContext,
  useFieldArray,
} from 'react-hook-form-mui';
import PopupState from 'material-ui-popup-state';
import { EdgeDirectionType, MultiEdgeKeyMode, PropertyDataType } from '@vesoft-inc/utils';
import { Trans, useTranslation } from 'react-i18next';
import { usePopupState, bindFocus, bindPopover, bindTrigger } from 'material-ui-popup-state/hooks';
import { observer } from 'mobx-react-lite';
import { CloseFilled, AddFilled, MoreVertFilled, HelpCircleOutline } from '@vesoft-inc/icons';

import {
  TypeInfoContainer,
  PropertyBodyCell,
  PropertyHeaderCell,
} from '@studio/pages/SchemaManager/GraphTypeBuilder/styles';
import { GraphTypeBuildMode, IEdgeTypeItem, ILabelItem, INodeTypeItem, IProperty } from '@studio/interfaces';
import { DECIMAL_ACCURACY } from '@studio/utils/constant';
import { getDuplicateValues } from '@studio/utils';
import { useStore } from '@studio/stores';
import ColorPicker from '@studio/components/ColorPicker';
import { ColorBox } from '../VisualBuilder/styles';

interface EdgeTypeConfigFormProps {
  hasSrcAndDstNode?: boolean;
  colorPicker?: boolean;
  slotProps?: {
    propertyList: ListProps;
  };
  onChange?: (values: IEdgeTypeItem) => void;
}

const itemTypeFilter = createFilterOptions<string>();
const labelOptionFilter = createFilterOptions<string>();

const directionOptions = [
  {
    label: '------------>',
    value: EdgeDirectionType.Forward,
  },
  {
    label: '-------------',
    value: EdgeDirectionType.Undirected,
  },
  {
    label: '<------------',
    value: EdgeDirectionType.Backward,
  },
];

function MoreAction({ index, readonly }: { index: number; readonly: boolean }) {
  const form = useFormContext<IEdgeTypeItem>();
  const properties = useWatch({
    control: form.control,
    name: 'properties',
  });
  const { t } = useTranslation(['graphtype']);
  return (
    <PopupState variant="popper" popupId={`moreaction-${index}`}>
      {(popupState) => (
        <>
          <IconButton size="small" {...bindTrigger(popupState)}>
            <MoreVertFilled />
          </IconButton>
          <Popover
            {...bindPopover(popupState)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 40,
            }}
            disablePortal
          >
            <Box minWidth={288} height={148} padding={(theme) => `${theme.spacing(2)} ${theme.spacing(3)}`}>
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
                        <Trans i18nKey="decimalPrecisionRange" values={{ DECIMAL_ACCURACY }} t={t} ns={'graphtype'} />
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
                      title={<Trans i18nKey="decimalScaleRange" values={{ DECIMAL_ACCURACY }} t={t} ns={'graphtype'} />}
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
                            (Number(value) < 1 || Number(value) > DECIMAL_ACCURACY || Number(value) > Number(MValue))
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
                    name={`properties.${index}.nullable`}
                    inputProps={{
                      disabled: readonly,
                    }}
                  />
                </PropertyBodyCell>
                <PropertyBodyCell>
                  <TextFieldElement
                    size="small"
                    name={`properties.${index}.default`}
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
  );
}

function EdgeTypeConfigForm(props: EdgeTypeConfigFormProps) {
  const { hasSrcAndDstNode, colorPicker, slotProps, onChange } = props;
  const theme = useTheme();
  const { t } = useTranslation(['graphtype']);
  const { schemaStore, mode } = useStore().graphtypeStore;
  const nodeTypeList = schemaStore?.nodeTypeList;
  const readonly = mode === GraphTypeBuildMode.Readonly;
  const form = useFormContext<IEdgeTypeItem>();

  const defaultValues = form.formState.defaultValues;

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

  const direction = useWatch({
    control: form.control,
    name: 'direction',
    defaultValue: defaultValues?.direction,
  });

  const selectedLabelOptions = useWatch({
    control: form.control,
    name: 'labels',
    defaultValue: (defaultValues?.labels || []).map((label) => label || ''),
  });

  const srcNode = useWatch({
    control: form.control,
    name: 'srcNode',
    defaultValue: defaultValues?.srcNode as INodeTypeItem,
  });

  const dstNode = useWatch({
    control: form.control,
    name: 'dstNode',
    defaultValue: defaultValues?.dstNode as INodeTypeItem,
  });

  const properties = useWatch({
    control: form.control,
    name: 'properties',
    defaultValue: (defaultValues?.properties || []).map((property) => new IProperty(property)),
  });

  const labelOptions = [
    ...new Set(Array.from(schemaStore?.edgeTypeLabelMap.keys() || []).concat(selectedLabelOptions)),
  ];

  const multiKeyModeOptions = useMemo(
    () => [
      {
        label: t('multiKeyMode_none', { ns: 'graphtype' }),
        value: MultiEdgeKeyMode.None,
      },
      {
        label: t('multiKeyMode_auto', { ns: 'graphtype' }),
        value: MultiEdgeKeyMode.Auto,
      },
      {
        label: t('multiKeyMode_customize', { ns: 'graphtype' }),
        value: MultiEdgeKeyMode.Customize,
      },
    ],
    []
  );

  const getDirectionOptions = () => {
    // const { srcNode, dstNode } = form.getValues();
    return [
      {
        label: `${srcNode?.name} -> ${dstNode?.name}`,
        value: EdgeDirectionType.Forward,
      },
      {
        label: `${srcNode?.name} - ${dstNode?.name}`,
        value: EdgeDirectionType.Undirected,
      },
      {
        label: `${srcNode?.name} <- ${dstNode?.name}`,
        value: EdgeDirectionType.Backward,
      },
    ];
  };

  const popupState = usePopupState({
    variant: 'popover',
    popupId: 'edge-color-picker',
  });

  const edgeStrokeColor = useWatch({
    control: form.control,
    name: 'style.strokeColor',
    defaultValue: defaultValues?.style?.strokeColor,
  });

  const curMultiEdgeKeyMode = useWatch({
    control: form.control,
    name: 'multiEdgeKeyMode',
    defaultValue: defaultValues?.multiEdgeKeyMode,
  });

  const targetId = form.formState.defaultValues?.id;
  useEffect(() => {
    if (!targetId) {
      return;
    }
    onChange?.(
      new IEdgeTypeItem({
        id: targetId,
        name,
        labels: selectedLabelOptions,
        direction,
        srcNode,
        dstNode,
        multiEdgeKeyMode: curMultiEdgeKeyMode,
        style: {
          strokeColor: edgeStrokeColor,
        },
        properties,
      })
    );
  }, [
    targetId,
    name,
    direction,
    srcNode,
    dstNode,
    curMultiEdgeKeyMode,
    edgeStrokeColor,
    properties,
    selectedLabelOptions,
    onChange,
  ]);

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <TypeInfoContainer>
        <Typography sx={{ mb: theme.spacing(2) }}>{t('edgeType', { ns: 'graphtype' })}</Typography>
        <Grid container rowSpacing={3}>
          <Grid size={{ xs: 6, md: 12 }}>
            <TextFieldElement
              size="small"
              label={t('edgeTypeName', { ns: 'graphtype' })}
              required
              name="name"
              fullWidth
              disabled={readonly}
            />
          </Grid>
          {hasSrcAndDstNode && (
            <Grid size={{ xs: 6, md: 12 }}>
              <TextFieldElement
                fullWidth
                select
                size="small"
                label={t('direction', { ns: 'graphtype' })}
                name="direction"
                disabled={readonly}
                onChange={(e) => {
                  const value = e.target.value as unknown as EdgeDirectionType;
                  form.setValue('direction', value);
                }}
              >
                {getDirectionOptions().map((option, index) => (
                  <MenuItem key={index} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextFieldElement>
            </Grid>
          )}
          <Grid size={{ xs: 6, md: 12 }} sx={{ display: hasSrcAndDstNode ? 'none' : undefined }}>
            <Grid container columnSpacing={2}>
              <Grid size={{ md: 4 }}>
                <SelectElement
                  size="small"
                  label={t('srcNodeType', { ns: 'graphtype' })}
                  required
                  options={nodeTypeList?.slice() || []}
                  labelKey="name"
                  objectOnChange
                  disabled={readonly}
                  onChange={(item: INodeTypeItem) => {
                    form.setValue('srcNode', item);
                    form.trigger('srcNode');
                  }}
                  valueKey="id"
                  name="srcNode"
                  fullWidth
                />
              </Grid>
              <Grid size={{ md: 4 }}>
                <SelectElement
                  size="small"
                  label={t('direction', { ns: 'graphtype' })}
                  options={directionOptions}
                  labelKey="label"
                  valueKey="value"
                  required
                  disabled={readonly}
                  name="direction"
                  fullWidth
                />
              </Grid>
              <Grid size={{ md: 4 }}>
                <SelectElement
                  size="small"
                  label={t('dstNodeType', { ns: 'graphtype' })}
                  options={nodeTypeList?.slice() || []}
                  labelKey="name"
                  valueKey="id"
                  objectOnChange
                  onChange={(item: INodeTypeItem) => {
                    form.setValue('dstNode', item);
                    form.trigger('dstNode');
                  }}
                  disabled={readonly}
                  required
                  name="dstNode"
                  fullWidth
                />
              </Grid>
            </Grid>
          </Grid>
          {colorPicker && (
            <Grid size={{ xs: 6, md: 12 }}>
              <Box {...bindFocus(popupState)} width="100%">
                <TextFieldElement
                  label={t('color', { ns: 'graphtype' })}
                  slotProps={{
                    input: {
                      startAdornment: <ColorBox sx={{ backgroundColor: edgeStrokeColor }} />,
                    },
                  }}
                  name="style.strokeColor"
                  size="small"
                  fullWidth
                  disabled={readonly}
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
                  color={edgeStrokeColor}
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
                validate: (values: ILabelItem[]) => {
                  const duplicateValues = getDuplicateValues<ILabelItem>(values || []);
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
                freeSolo: true,
                autoSelect: true,
                clearIcon: <CloseFilled fontSize="small" />,
                ChipProps: {
                  size: 'small',
                  sx: {
                    height: 22,
                    borderRadius: 2,
                  },
                },
                blurOnSelect: true,
                handleHomeEndKeys: true,
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
          <Grid size={{ xs: 6, md: 12 }}>
            <SelectElement
              fullWidth
              label={t('multiKeyMode', { ns: 'graphtype' })}
              size="small"
              name="multiEdgeKeyMode"
              options={multiKeyModeOptions}
              labelKey="label"
              disabled={readonly}
              valueKey="value"
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
          <PropertyHeaderCell>
            <Typography>{t('propType', { ns: 'graphtype' })}</Typography>
          </PropertyHeaderCell>
          {curMultiEdgeKeyMode === MultiEdgeKeyMode.Customize && (
            <PropertyHeaderCell sx={{ flex: 0, flexBasis: '18%' }}>
              <Typography fontSize={12}>{t('multiEdgeKey', { ns: 'graphtype' })}</Typography>
            </PropertyHeaderCell>
          )}
        </Stack>
        <List {...slotProps?.propertyList}>
          {fields?.map((property, index) => (
            <Grid key={property.id || index} direction="row" container alignItems="center">
              <Grid size={{ xs: 3 }}>
                <PropertyBodyCell>
                  <TextFieldElement
                    required
                    size="small"
                    fullWidth
                    disabled={readonly}
                    label={t('propName', { ns: 'graphtype' })}
                    rules={{
                      required: true,
                      validate: (value) => {
                        return form.getValues('properties').find((p, i) => i !== index && p.name === value)
                          ? 'Duplicate'
                          : true;
                      },
                    }}
                    name={`properties.${index}.name`}
                  />
                </PropertyBodyCell>
              </Grid>
              <Grid sx={{ flex: 1, minWidth: 0 }}>
                <PropertyBodyCell>
                  <AutocompleteElement
                    name={`properties[${index}].type`}
                    label={t('propType', { ns: 'graphtype' })}
                    required
                    options={Object.values(PropertyDataType)}
                    textFieldProps={{
                      slotProps: {
                        root: {
                          sx: {
                            flexShrink: 1,
                          },
                        },
                      },
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
                  {(properties[index]?.type === PropertyDataType.LIST ||
                    properties[index]?.type === PropertyDataType.SET) && (
                    <PropertyBodyCell sx={{ flex: '1 0 220px' }}>
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
                              item !== fields[index]?.itemType
                          ),
                          properties[index]?.itemType || [],
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
                      <PropertyBodyCell sx={{ flex: '1 0 150px' }}>
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
                                item !== fields[index]?.keyType
                            ),
                            properties[index]?.keyType || [],
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
                      <PropertyBodyCell sx={{ flex: '1 0 150px' }}>
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
                                item !== fields[index]?.valueType
                            ),
                            properties[index]?.valueType || [],
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
                    <PropertyBodyCell sx={{ flex: '1 0 200px' }}>
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
                  {!readonly && curMultiEdgeKeyMode !== MultiEdgeKeyMode.Customize && (
                    <Box display="flex" alignItems="center">
                      <MoreAction index={index} readonly={readonly} />
                      <IconButton onClick={handleDelete(index)}>
                        <CloseFilled />
                      </IconButton>
                    </Box>
                  )}
                </PropertyBodyCell>
              </Grid>
              {curMultiEdgeKeyMode === MultiEdgeKeyMode.Customize && (
                <Grid size={{ xs: 2 }}>
                  <PropertyBodyCell display="flex" justifyContent={readonly ? 'center' : 'space-between'}>
                    <CheckboxElement sx={{ flex: 1 }} name={`properties.${index}.multiEdgeKey`} />
                    <Box display="flex" alignItems="center">
                      <MoreAction index={index} readonly={readonly} />
                      {!readonly && (
                        <IconButton onClick={handleDelete(index)}>
                          <CloseFilled />
                        </IconButton>
                      )}
                    </Box>
                  </PropertyBodyCell>
                </Grid>
              )}
            </Grid>
          ))}
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
        </List>
      </TypeInfoContainer>
    </Box>
  );
}

export default observer(EdgeTypeConfigForm);
