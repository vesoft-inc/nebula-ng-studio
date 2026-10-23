import { Box, Button, Checkbox, Divider, IconButton, ListItemText, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useExplorerStore } from '../../../../../context';
import { SiderPanel } from '../../../../../../graph/types/index';
import { CloseFilled } from '@vesoft-inc/icons';
import { DirectionSelector, NodeItemBar, PathFilterTypeSelector, QueryTitle, StepType } from '../styles';
import { observer } from 'mobx-react-lite';
import { FormContainer, RadioButtonGroup, SelectElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { EdgeDirectionType } from '@vesoft-inc/utils';
import { ALL_EDGE_TYPE_KEY, PathFilterType, PathType } from '../../../../../../graph/constants';
import { SelectProps } from '../../../../../../graph/utils/helpers';

type QueryPathFrom = {
  direction: EdgeDirectionType;
  pathType: PathType;
  stepType: StepType;
  edgeType: string[];
  pathFilterType: PathFilterType;
  step?: number;
  minStep?: number;
  maxStep?: number;
};

function QueryPath() {
  const { graphWorkspace } = useExplorerStore();
  const { nodesSelected } = graphWorkspace.graph;
  const { t } = useTranslation(['explorer']);
  const srcNode = Array.from(nodesSelected)[0];
  const dstNode = Array.from(nodesSelected)[1];

  const form = useForm<QueryPathFrom>({
    defaultValues: {
      direction: EdgeDirectionType.Forward,
      stepType: StepType.Single,
      pathType: PathType.All,
      pathFilterType: PathFilterType.WALK,
      step: 1,
      edgeType: [ALL_EDGE_TYPE_KEY],
    },
  });

  const stepType = form.watch('stepType');
  const minStep = form.watch('minStep');

  const handleQueryPath = async (formValues: QueryPathFrom) => {
    const { graph } = graphWorkspace;
    const { direction, pathType, stepType, pathFilterType, step, minStep, maxStep, edgeType } = formValues;

    let type: string[] | typeof ALL_EDGE_TYPE_KEY = edgeType;
    if (edgeType.includes(ALL_EDGE_TYPE_KEY)) {
      type = ALL_EDGE_TYPE_KEY;
    }

    if (stepType === StepType.Single) {
      await graph.queryPath({
        sourceNode: srcNode!,
        targetNode: dstNode!,
        edgeTypes: type,
        pathFilterType,
        direction,
        pathType,
        minStep: step!,
      });
    } else {
      await graph.queryPath({
        sourceNode: srcNode!,
        targetNode: dstNode!,
        edgeTypes: type,
        pathFilterType,
        direction,
        pathType,
        minStep: minStep!,
        maxStep: maxStep!,
      });
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
        {t('queryPath', { ns: 'explorer' })}
        <IconButton
          onClick={() => {
            graphWorkspace.updateActiveSiderKey(SiderPanel.GraphQuery);
          }}
        >
          <CloseFilled />
        </IconButton>
      </Typography>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ height: 'calc(100% - 40px)', overflowY: 'auto' }}>
        <QueryTitle my={1}>{t('sourceVertex', { ns: 'explorer' })}</QueryTitle>
        <Box width="100%">{srcNode ? <NodeItemBar node={srcNode} /> : <NodeItemBar />}</Box>
        <QueryTitle my={2}>{t('destinationNode', { ns: 'explorer' })}</QueryTitle>
        <Box width="100%">{dstNode ? <NodeItemBar node={dstNode} /> : <NodeItemBar />}</Box>
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
                    const values = selected as string[];
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
                      <Checkbox checked={form.getValues('edgeType')!.includes(item.value)} />
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
              <QueryTitle>{t('pathSearchPrefix', { ns: 'explorer' })}</QueryTitle>
              <Box pl={1} mt={0.5}>
                <RadioButtonGroup
                  name="pathType"
                  options={[
                    {
                      id: PathType.All,
                      label: t('allPath', { ns: 'explorer' }),
                    },
                    {
                      id: PathType.AnyOne,
                      label: t('anyOnePath', { ns: 'explorer' }),
                    },
                    {
                      id: PathType.AllShortest,
                      label: t('allShortestPath', { ns: 'explorer' }),
                    },
                    {
                      id: PathType.OneShortest,
                      label: t('anyShortest', { ns: 'explorer' }),
                    },
                  ]}
                />
              </Box>
            </Box>
            <Box>
              <QueryTitle>{t('pathType', { ns: 'explorer' })}</QueryTitle>
              <Box pl={1} mt={0.5}>
                <PathFilterTypeSelector />
              </Box>
            </Box>
            <Box>
              <QueryTitle>{t('stepType', { ns: 'explorer' })}</QueryTitle>
              <Box pl={1} mt={0.5}>
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
          variant="contained"
          sx={{ mt: 2 }}
          fullWidth
          disabled={!srcNode || !dstNode}
          onClick={form.handleSubmit(handleQueryPath)}
        >
          {t('query', { ns: 'explorer' })}
        </Button>
      </Box>
    </Box>
  );
}

export default observer(QueryPath);
