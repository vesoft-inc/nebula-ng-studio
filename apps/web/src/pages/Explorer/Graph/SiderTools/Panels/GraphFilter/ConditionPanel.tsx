import { Box, Chip, IconButton, Stack, Tooltip } from '@mui/material';
import { SelectElement, SwitchElement, TextFieldElement, useFormContext } from 'react-hook-form-mui';

import { useTranslation } from 'react-i18next';
import CollapseItem from '@studio/components/GraphWorkbench/Collapse';
import { ConditionFilterForm } from '.';
import { Delete, DotsHexagon, EdgeType } from '@vesoft-inc/icons';
import { observer } from 'mobx-react-lite';
import { useStore } from '@studio/stores';
import { DescEdgeTypeResult, DescGraphTypeResult, DescNodeTypeResult, GraphEntityType } from '@vesoft-inc/utils';
import { useEffect, useRef, useState } from 'react';
import { OperatorType } from '@studio/utils/explorer/constant';
import { ConditionFilter } from '@studio/interfaces/explorer';
import { SelectProps } from '@studio/utils/graph/helpers';

interface IConditionPanelProps {
  index: number;
  onDelete: () => void;
  onApplyFilter: () => void;
  condition: ConditionFilter;
}

function ConditionPanel(props: IConditionPanelProps) {
  const { index, onDelete, onApplyFilter, condition } = props;
  const form = useFormContext<ConditionFilterForm>();
  const { t } = useTranslation(['explorer']);
  const [curEntity, setCurEntity] = useState<DescGraphTypeResult | undefined>(
    form.getValues(`conditions.${index}.entity`)
  );

  useEffect(() => {
    setCurEntity(form.getValues(`conditions.${index}.entity`));
    form.setValue(`conditions.${index}.value`, condition.value);
  }, [condition]);

  const {
    curNodeTypes,
    curEdgeTypes,
    graph: { nodeColorPicker },
  } = useStore().explorerStore.graphWorkspace;
  const entity = form.getValues(`conditions.${index}.entity`);
  const [properties, setProperties] = useState<DescNodeTypeResult[] | DescEdgeTypeResult[]>(
    entity?.propertyInfos || []
  );
  const formValidatorTriggered = useRef<boolean>(false);

  useEffect(() => {
    if (!curEntity) return;
    setProperties(curEntity.propertyInfos);
  }, [curEntity, curNodeTypes, curEdgeTypes]);

  const renderEntityLabel = () => {
    if (!curEntity) {
      return (
        <Chip
          sx={{
            minWidth: 50,
            maxWidth: 84,
            textOverflow: 'ellipsis',
            height: 22,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          label={'type'}
          size="small"
        />
      );
    }
    if (curEntity.entity_type === GraphEntityType.Node) {
      return (
        <Chip
          sx={{
            minWidth: 50,
            maxWidth: 84,
            textOverflow: 'ellipsis',
            height: 22,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            backgroundColor: nodeColorPicker.whichColor(curEntity.type_name),
          }}
          label={curEntity.type_name}
          size="small"
        />
      );
    }
    return <>- {curEntity.type_name} -</>;
  };

  const { enable, value, operator, property_name, entity_name } = condition;

  const getConditionInfo = () => {
    if (!curEntity) return '';
    if (!entity_name || !property_name || !operator || !value) return t('invalidCondition', { ns: 'explorer' });
    return `${curEntity.type_name}[${property_name}] ${operator} ${value}`;
  };

  const isMounted = useRef(false);
  const effectRan = useRef(false);

  useEffect(() => {
    if (!effectRan.current) {
      effectRan.current = true;
      return;
    }
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (formValidatorTriggered.current) {
      form.trigger(`conditions.${index}`);
    }
    if (effectRan.current && effectRan.current) {
      if (!enable) return;
      setTimeout(() => {
        form.setValue(`conditions.${index}.enable`, false);
        onApplyFilter();
      }, 10);
    }
  }, [value, operator, property_name, entity_name, index]);

  return (
    <Box
      sx={{
        width: '100%',
        height: 'auto',
        borderRadius: '6px',
        padding: (theme) => `${theme.spacing(0.5)} ${theme.spacing(1.5)} ${theme.spacing(1.5)} ${theme.spacing(1.5)}`,
        backgroundColor: (theme) => theme.palette.vesoft.v2.bg3,
        border: (theme) => `1px solid ${theme.palette.vesoft.v2.border2}`,
        '&:not(:last-child)': {
          mb: 1,
        },
      }}
    >
      <CollapseItem
        slotProps={{
          subItemSx: {
            pl: 0,
          },
        }}
        title={
          <Tooltip placement="top" arrow title={getConditionInfo()}>
            {renderEntityLabel()}
          </Tooltip>
        }
        unmountOnExit={false}
        rightPart={
          <Box display="flex" alignItems="center">
            <SwitchElement
              name={`conditions.${index}.enable`}
              label={t('apply', { ns: 'explorer' })}
              sx={{ mr: 0.5 }}
              onClick={async () => {
                const isValid = await form.trigger(`conditions.${index}`);
                formValidatorTriggered.current = true;
                if (!isValid) {
                  form.setValue(`conditions.${index}.enable`, false);
                  return;
                }
                onApplyFilter();
              }}
            />
            <IconButton sx={{ color: (theme) => theme.palette.vesoft.v2.text4 }} onClick={onDelete}>
              <Delete fontSize="medium" />
            </IconButton>
          </Box>
        }
        defaultOpen
      >
        <Stack mt={1} direction="column" spacing={1.5}>
          <SelectElement
            name={`conditions.${index}.entity_name`}
            label={t('nodeOrEdgeType', { ns: 'explorer' })}
            fullWidth
            size="small"
            labelKey="label"
            valueKey="value"
            required
            SelectProps={SelectProps}
            options={curNodeTypes.concat(curEdgeTypes).map((item) => ({
              label: (
                <Box key={item.type_name} textTransform="none" display="flex">
                  {item.entity_type === GraphEntityType.Node ? <DotsHexagon /> : <EdgeType />}
                  <Box ml={1}>{item.type_name}</Box>
                </Box>
              ),
              value: item.type_name,
              item,
            }))}
            objectOnChange
            onChange={({ item }) => {
              setCurEntity(item);
              form.setValue(`conditions.${index}.property`, undefined);
              form.setValue(`conditions.${index}.property_name`, undefined);
              form.setValue(`conditions.${index}.entity`, item);
            }}
          />
          <SelectElement
            fullWidth
            name={`conditions.${index}.property_name`}
            labelKey="label"
            valueKey="value"
            required
            options={properties.map((property) => ({
              label: (
                <Box key={property.property_name} textTransform="none">
                  {property.property_name} <Chip size="small" label={property.data_type} />
                </Box>
              ),
              value: property.property_name,
              item: property,
            }))}
            size="small"
            label={t('propertyName', { ns: 'explorer' })}
            SelectProps={SelectProps}
            objectOnChange
            onChange={({ item }) => {
              form.setValue(`conditions.${index}.property`, item);
              form.setValue(`conditions.${index}.property_name`, item.property_name);
            }}
          />
          <SelectElement
            fullWidth
            name={`conditions.${index}.operator`}
            labelKey="label"
            valueKey="value"
            options={Object.values(OperatorType).map((operator) => ({
              label: operator,
              value: operator,
            }))}
            size="small"
            label={t('operator', { ns: 'explorer' })}
            SelectProps={SelectProps}
          />
          <TextFieldElement
            size="small"
            name={`conditions.${index}.value`}
            required
            label={t('propertyValue', { ns: 'explorer' })}
            fullWidth
            sx={{
              background: (theme) => theme.palette.vesoft.v2.bg1,
            }}
          />
        </Stack>
      </CollapseItem>
    </Box>
  );
}

export default observer(ConditionPanel);
