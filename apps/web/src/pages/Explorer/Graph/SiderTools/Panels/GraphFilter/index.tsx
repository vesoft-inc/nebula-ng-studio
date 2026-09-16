import { observer } from 'mobx-react-lite';
import { useStore } from '@studio/stores';
import { Box, Button, Divider, IconButton, Typography } from '@mui/material';
import { CloseFilled } from '@vesoft-inc/icons';
import { useTranslation } from 'react-i18next';
import ConditionPanel from './ConditionPanel';
import { OperatorType } from '@studio/utils/explorer/constant';
import { FormContainer, RadioButtonGroup, useFieldArray, useForm } from 'react-hook-form-mui';
import { VertexFilterDisplay } from '@studio/stores/graph/vertexFilter';
import { ConditionFilter } from '@studio/interfaces/explorer';
import { useEffect } from 'react';

export type ConditionFilterForm = {
  filterType: VertexFilterDisplay;
  conditions: ConditionFilter[];
};

const initialCondition = {
  entity: undefined,
  property: undefined,
  entity_name: '',
  property_name: '',
  operator: OperatorType.Equal,
  value: '',
  enable: false,
};

export default observer(function GraphFilter() {
  const {
    explorerStore: { graphWorkspace },
  } = useStore();
  const { updateActiveSiderKey } = graphWorkspace;
  const { t } = useTranslation(['explorer']);

  const form = useForm<ConditionFilterForm>({
    defaultValues: {
      filterType: VertexFilterDisplay.Grayscale,
      conditions: (graphWorkspace.graph.filterList.length
        ? graphWorkspace.graph.filterList
        : [new ConditionFilter(initialCondition)]
      ).map((i) => i.getValues()),
    },
  });

  const { append, remove } = useFieldArray({
    control: form.control,
    name: 'conditions',
  });

  const handleAddFilter = () => {
    append(new ConditionFilter(initialCondition));
  };

  const handleApplyFilter = () => {
    const conditions = form.getValues('conditions');
    const { vertexFilterStore } = graphWorkspace.graph;
    vertexFilterStore.setFilterType(form.getValues('filterType'));
    graphWorkspace.graph.updateFilterList(conditions.map((condition) => new ConditionFilter(condition)));
    vertexFilterStore.handleGraphFilter();
  };

  const conditions = form.watch('conditions');

  const filterType = form.watch('filterType');

  useEffect(() => {
    handleApplyFilter();
  }, [filterType]);

  return (
    <Box display="flex" flexDirection="column" height="100%">
      <Typography
        fontWeight={500}
        sx={{ color: (theme) => theme.palette.vesoft.textColor1 }}
        flex={0}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        {t('graphFilter', { ns: 'explorer' })}
        <IconButton
          onClick={() => {
            updateActiveSiderKey(undefined);
          }}
        >
          <CloseFilled />
        </IconButton>
      </Typography>
      <Divider />
      <Box
        mt={2}
        maxHeight="calc(100% - 36px)"
        sx={{
          overflowY: 'auto',
        }}
      >
        <FormContainer formContext={form}>
          <Box>
            <Typography
              sx={{
                color: (theme) => theme.palette.vesoft.v2.text3,
                fontSize: 12,
              }}
            >
              {t('filterTypeTip', { ns: 'explorer' })}
            </Typography>
            <RadioButtonGroup
              name="filterType"
              options={[
                {
                  id: VertexFilterDisplay.Hide,
                  label: t('hide', { ns: 'explorer' }),
                },
                {
                  id: VertexFilterDisplay.Grayscale,
                  label: t('dismiss', { ns: 'explorer' }),
                },
              ]}
              row
            />
          </Box>
          {conditions.map((condition, index) => (
            <ConditionPanel
              index={index}
              key={index}
              condition={condition}
              onDelete={() => {
                remove(index);
                handleApplyFilter();
              }}
              onApplyFilter={handleApplyFilter}
            />
          ))}
        </FormContainer>
      </Box>
      <Button sx={{ mt: 2 }} variant="contained" fullWidth onClick={handleAddFilter}>
        {t('addFilter', { ns: 'explorer' })}
      </Button>
    </Box>
  );
});
