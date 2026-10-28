import { useEffect } from 'react';
import { Box, Button, Checkbox, Divider, IconButton, ListItemText, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CloseFilled } from '@vesoft-inc/icons';
import { observer } from 'mobx-react-lite';
import { FormContainer, RadioButtonGroup, SelectElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { DescEdgeTypeResult, EdgeDirectionType } from '@vesoft-inc/studio-core/contracts';

import { useExplorerStore } from '../../../../../context';
import { SiderPanel } from '../../../../../../graph/types/index';

import { DirectionSelector, NodeItemBar, QueryTitle, StepType } from '../styles';
import { SelectProps } from '../../../../../../graph/utils/helpers';
import { ALL_EDGE_TYPE_KEY } from '../../../../../../graph/constants';

type EdgeTypeKeys = DescEdgeTypeResult['type_name'][] | [typeof ALL_EDGE_TYPE_KEY];

type ExploreRelationFrom = {
  edgeType: EdgeTypeKeys;
  direction: EdgeDirectionType;
  stepType: StepType;
  step?: number;
  minStep?: number;
  maxStep?: number;
};

function ExploreRelation() {
  const { graphWorkspace } = useExplorerStore();
  const { nodesSelected } = graphWorkspace.graph;
  const { t } = useTranslation(['explorer']);
  const form = useForm<ExploreRelationFrom>({
    defaultValues: {
      edgeType: [ALL_EDGE_TYPE_KEY],
      direction: EdgeDirectionType.Forward,
      stepType: StepType.Single,
      step: 2,
    } as ExploreRelationFrom,
  });

  const stepType = form.watch('stepType');
  const minStep = form.watch('minStep');

  const handleExploreRelation = async (formValues: ExploreRelationFrom) => {
    const { graph } = graphWorkspace;
    const { direction, stepType, step, minStep, maxStep, edgeType } = formValues;

    let type: string[] | typeof ALL_EDGE_TYPE_KEY = edgeType;
    if (edgeType.includes(ALL_EDGE_TYPE_KEY)) {
      type = ALL_EDGE_TYPE_KEY;
    }

    if (stepType === StepType.Single) {
      await graph.queryRelation(type, direction, step!);
    } else {
      await graph.queryRelation(type, direction, minStep!, maxStep);
    }
  };

  const handleStepInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(e.target.value, 10);
    if (value < 1) {
      value = 1;
      e.target.value = value.toString();
    }
  };

  const selectedEdgeTypes = form.watch('edgeType');

  useEffect(() => {
    if (selectedEdgeTypes.length > 1) {
      if (selectedEdgeTypes[selectedEdgeTypes.length - 1] === ALL_EDGE_TYPE_KEY) {
        form.setValue('edgeType', [ALL_EDGE_TYPE_KEY]);
        return;
      }
      form.setValue(
        'edgeType',
        selectedEdgeTypes.filter((name) => name !== ALL_EDGE_TYPE_KEY)
      );
      return;
    }
    if (selectedEdgeTypes.includes(ALL_EDGE_TYPE_KEY)) {
      form.setValue('edgeType', [ALL_EDGE_TYPE_KEY]);
      return;
    }
  }, [selectedEdgeTypes.length]);

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
        {t('exploreRelation', { ns: 'explorer' })}
        <IconButton
          onClick={() => {
            graphWorkspace.updateActiveSiderKey(SiderPanel.GraphQuery);
          }}
        >
          <CloseFilled />
        </IconButton>
      </Typography>
      <Divider />
      <QueryTitle my={2}>{t('selectVertex', { ns: 'explorer' })}</QueryTitle>
      <Box width="100%" maxHeight={300} sx={{ overflowY: 'auto' }}>
        {nodesSelected.size === 0 ? (
          <NodeItemBar />
        ) : (
          Array.from(nodesSelected).map((node, index) => <NodeItemBar key={index} node={node} />)
        )}
      </Box>
      <FormContainer formContext={form}>
        <Stack spacing={2} mt={2}>
          <Box>
            <QueryTitle>{t('edgeType', { ns: 'explorer' })}</QueryTitle>
            <SelectElement
              name="edgeType"
              sx={{ mt: 1 }}
              required
              fullWidth
              size="small"
              labelKey="label"
              valueKey="value"
              SelectProps={{
                ...SelectProps,
                multiple: true,
                renderValue: (selected) => {
                  const values = selected as string[] | [typeof ALL_EDGE_TYPE_KEY];
                  if (values.includes(ALL_EDGE_TYPE_KEY)) {
                    return t('all', { ns: 'explorer' });
                  }
                  return values.join(', ');
                },
              }}
              options={[
                {
                  label: t('all', { ns: 'explorer' }),
                  value: ALL_EDGE_TYPE_KEY,
                },
                ...graphWorkspace.curEdgeTypes.map((edgeType) => ({
                  label: edgeType.type_name,
                  value: edgeType.type_name,
                })),
              ].map((item) => ({
                value: item.value,
                rLable: item.label,
                label: (
                  <Box maxWidth={218} display="flex" alignItems="center">
                    <Checkbox checked={form.getValues('edgeType')!.includes(item.value as typeof ALL_EDGE_TYPE_KEY)} />
                    <ListItemText
                      sx={{
                        span: {
                          fontSize: 12,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          width: '100%',
                          whiteSpace: 'nowrap',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                        },
                      }}
                      title={item.label}
                      aria-label={item.label}
                      primary={item.label}
                    />
                  </Box>
                ),
              }))}
            />
          </Box>
          <Box>
            <QueryTitle>{t('direction', { ns: 'explorer' })}</QueryTitle>
            <DirectionSelector />
          </Box>
          <Box>
            <QueryTitle>{t('stepType', { ns: 'explorer' })}</QueryTitle>
            <RadioButtonGroup
              name="stepType"
              options={[
                {
                  label: t('fixed', { ns: 'explorer' }),
                  id: StepType.Single,
                },
                {
                  label: t('range', { ns: 'explorer' }),
                  id: StepType.Range,
                },
              ]}
              row
            />
          </Box>
          {stepType === StepType.Single && (
            <TextFieldElement
              name="step"
              label={t('stepType', { ns: 'explorer' })}
              fullWidth
              inputProps={{
                type: 'number',
                min: 1,
              }}
              onInput={handleStepInputChange}
              type="number"
              size="small"
              required
            />
          )}
          {stepType === StepType.Range && (
            <Stack spacing={2} direction="row" alignItems="center">
              <TextFieldElement
                name="minStep"
                label={t('minStep', { ns: 'explorer' })}
                fullWidth
                size="small"
                inputProps={{
                  type: 'number',
                  min: 1,
                }}
                type="number"
                required
              />
              <Box
                sx={{
                  backgroundColor: (theme) => theme.palette.vesoft.v2.text2,
                  width: 16,
                  height: 2,
                }}
              />
              <TextFieldElement
                name="maxStep"
                label={t('maxStep', { ns: 'explorer' })}
                fullWidth
                size="small"
                inputProps={{
                  type: 'number',
                  min: (minStep || 1) + 1,
                }}
                type="number"
                required
              />
            </Stack>
          )}
        </Stack>
      </FormContainer>
      <Button
        sx={{ mt: 2 }}
        disabled={nodesSelected.size === 0}
        variant="contained"
        fullWidth
        onClick={form.handleSubmit(handleExploreRelation)}
      >
        {t('query', { ns: 'explorer' })}
      </Button>
    </Box>
  );
}

export default observer(ExploreRelation);
