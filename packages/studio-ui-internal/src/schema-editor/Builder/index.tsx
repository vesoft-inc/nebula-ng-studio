import { Alert, Box, Button, ButtonGroup, Container, Tooltip, useTheme } from '@mui/material';
import BreadCrumbs from '../../shared/BreadCrumbs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';
import domtoimage from 'dom-to-image';

import { useModal } from '../../shared/useModal';
import { useGraphTypeStore } from '../context';
import {
  ActionContainer,
  ContentContainer,
  CreateGraphContainer,
  FooterContainer,
  StepContainer,
  TableContainer,
} from './styles';
import VisualBuilder from './VisualBuilder/index';
import NodeTypeTable from './NodeType/index';
import EdgeTypeTable from './EdgeType/index';
import Preview from './Preview';
import { GraphTypeBuildMode } from '../../schema/types';
import { ActiveItemInfo } from '../SchemaEditorState';
import LabelTable from './LabelTable/index';
import { generateAlterGraphTypeGQL, generateCreateGraphTypeGQL } from './VisualBuilder/util';
import { CloseFilled, EditFilled } from '@vesoft-inc/icons';

import { VisualEditorType } from '../../shared/constants';
import GroupButton from '../../shared/SegmentButton/index';
import TitleEllipsis from '../../shared/TitleEllipsis';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { MassiveGraphConfirmMask } from './VisualBuilder/MassiveGraphConfirmMask';
import { validateGraphTypeDecimals, validateGraphTypePrimaryKeys } from './validation';
import { getGraphTypeSubmissionError } from './submissionError';

enum CreateGraphTypeStep {
  create,
  preview,
}

enum CreateFunction {
  VisualBuilder,
  NodeType,
  EdgeType,
  Label,
  Index,
}

interface FunctionTabs {
  name: string;
  type: CreateFunction;
}

const thumbnailMaxWidth = 195;
const thumbnailMaxHeight = 113;

export interface SchemaEditorProps {
  mode: GraphTypeBuildMode;
  graphTypeName?: string;
  sketchId?: number;
  onSaved?: (graphTypeName: string) => void;
  onBack?: () => void;
  onEdit?: (graphTypeName: string) => void;
  onView?: (graphTypeName: string) => void;
}

function GraphTypeBuilder(props: SchemaEditorProps) {
  const { mode, sketchId, onSaved, onBack, onEdit, onView } = props;
  const params = { graphTypeName: props.graphTypeName };
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const { t } = useTranslation(['graphtype']);
  const [curStep, setCurStep] = useState<CreateGraphTypeStep>(CreateGraphTypeStep.create);
  const graphtypeStore = useGraphTypeStore();
  const [curTab, setCurTab] = useState<CreateFunction>(CreateFunction.VisualBuilder);
  const message = useModal().message;
  const [curNgql, setCurNgql] = useState('');
  const [pendingInvalidItem, setPendingInvalidItem] = useState<ActiveItemInfo | null>(null);
  const [submissionError, setSubmissionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef<symbol | null>(null);
  const readonlyMode = mode === GraphTypeBuildMode.Readonly;

  const FunctionTabs = useMemo<FunctionTabs[]>(
    () => [
      {
        name: t('visualBuilder', { ns: 'graphtype' }),
        type: CreateFunction.VisualBuilder,
      },
      {
        name: t('nodeType', { ns: 'graphtype' }),
        type: CreateFunction.NodeType,
      },
      {
        name: t('edgeType', { ns: 'graphtype' }),
        type: CreateFunction.EdgeType,
      },
      {
        name: t('label', { ns: 'graphtype' }),
        type: CreateFunction.Label,
      },
    ],
    [t]
  );

  const form = useForm({
    defaultValues: {
      graphTypeName: '',
    },
  });
  const graphTypeName = form.watch('graphTypeName');
  const getPrimaryKeyErrors = () =>
    validateGraphTypePrimaryKeys({
      mode,
      nodeTypeList: graphtypeStore.schemaStore?.nodeTypeList.slice() || [],
      originalNodeTypeList: graphtypeStore.schemaStore?.originalNodeTypeList || [],
      graphTypeName,
      originalGraphTypeName: graphtypeStore.schemaStore?.graphtypeName,
    });

  useEffect(() => {
    setCurStep(CreateGraphTypeStep.create); // Reset to initial status on location change (menu item changed)
    setPendingInvalidItem(null);
    setSubmissionError('');
    setIsSubmitting(false);
    submittingRef.current = null;
    graphtypeStore.updateMode(mode);
    const load = (pending?: Promise<unknown>) =>
      pending?.catch((error) => {
        if (active)
          setSubmissionError(getGraphTypeSubmissionError(error, t('graphTypeSubmitFailed', { ns: 'graphtype' })));
      });
    let active = true;
    switch (mode) {
      case GraphTypeBuildMode.Create:
        graphtypeStore.initSchemaStore();
        break;
      case GraphTypeBuildMode.Edit:
      case GraphTypeBuildMode.Readonly: {
        const { graphTypeName } = params;
        if (graphTypeName) {
          graphtypeStore.initSchemaStore();
          load(graphtypeStore.schemaStore?.transformGraphTypeToEditorFromDDL(graphTypeName));
        }
        break;
      }
      case GraphTypeBuildMode.Sketch: {
        if (sketchId) {
          graphtypeStore.initSchemaStore();
          load(graphtypeStore.schemaStore?.transformGrapTypeBySketch(sketchId));
        }
        break;
      }
      default:
        break;
    }
    return () => {
      active = false;
      submittingRef.current = null;
      graphtypeStore.destroySchemaStore();
    };
  }, [mode, props.graphTypeName, sketchId, graphtypeStore]);

  useEffect(() => {
    const graphTypeName = graphtypeStore.schemaStore?.graphtypeName;
    if (graphTypeName) {
      form.reset({
        graphTypeName,
      });
    } else {
      form.reset({
        graphTypeName: '',
      });
    }
  }, [graphtypeStore.schemaStore?.graphtypeName]);

  useEffect(() => {
    setSubmissionError('');
  }, [graphTypeName, curStep]);

  const validateSchema = () => {
    const schema = graphtypeStore.schemaStore;
    const decimalError = validateGraphTypeDecimals(schema?.nodeTypeList || [], schema?.edgeTypeList || [])[0];
    const firstError = getPrimaryKeyErrors()[0];
    if (!firstError && !decimalError) return true;
    setCurStep(CreateGraphTypeStep.create);
    setCurTab(CreateFunction.VisualBuilder);
    setHasConfirmedHeavyRender(true);
    if (firstError) setPendingInvalidItem({ type: VisualEditorType.Tag, value: firstError.node });
    else if (decimalError) {
      const node = schema?.nodeTypeList.find((node) => node.id === decimalError.entity.id);
      const edge = schema?.edgeTypeList.find((edge) => edge.id === decimalError.entity.id);
      if (node) setPendingInvalidItem({ type: VisualEditorType.Tag, value: node });
      else if (edge) setPendingInvalidItem({ type: VisualEditorType.Edge, value: edge });
    }
    return false;
  };

  const handeNextClick = () => {
    form.handleSubmit(() => {
      if (!validateSchema()) return;
      setCurStep(curStep + 1);
    })();
  };

  useEffect(() => {
    if (curStep === CreateGraphTypeStep.preview) {
      getNgql();
    }
  }, [curStep]);

  const handlePreviousClick = () => {
    setCurStep(curStep - 1);
  };

  const getCreateGraphTypeNgql = () => {
    const { graphTypeName } = form.getValues();
    const nodeTypeList = graphtypeStore.schemaStore?.nodeTypeList || [];
    const edgeTypeList = graphtypeStore.schemaStore?.edgeTypeList || [];
    return generateCreateGraphTypeGQL({
      graphTypeName,
      nodeTypeList,
      edgeTypeList,
    });
  };

  const detectNameConflicts = (): string[] => {
    if (!graphtypeStore.schemaStore) return [];
    // A graph-type rename does not submit edits to its contained entities.
    if (form.getValues('graphTypeName') !== graphtypeStore.schemaStore.graphtypeName) return [];
    const { nodeTypeList, edgeTypeList, originalEdgeTypeList, originalNodeTypeList } = graphtypeStore.schemaStore;

    const droppedNodeNames = originalNodeTypeList
      .filter((node) => !nodeTypeList.find((n) => n.id === node.id))
      .map((node) => node.name);
    const createdNodeNames = nodeTypeList
      .filter((node) => !originalNodeTypeList.find((n) => n.id === node.id))
      .map((node) => node.name);

    const droppedEdgeNames = originalEdgeTypeList
      .filter((edge) => !edgeTypeList.find((e) => e.id === edge.id))
      .map((edge) => edge.name);
    const createdEdgeNames = edgeTypeList
      .filter((edge) => !originalEdgeTypeList.find((e) => e.id === edge.id))
      .map((edge) => edge.name);

    const conflicts: string[] = [];
    for (const name of createdNodeNames) {
      if (droppedNodeNames.includes(name)) {
        conflicts.push(`${t('nodeType', { ns: 'graphtype' })}: ${name}`);
      }
    }
    for (const name of createdEdgeNames) {
      if (droppedEdgeNames.includes(name)) {
        conflicts.push(`${t('edgeType', { ns: 'graphtype' })}: ${name}`);
      }
    }
    return conflicts;
  };

  const getAlterGraphTypeNgql = () => {
    if (!graphtypeStore.schemaStore) return '';
    const {
      graphtypeName: original_graphType,
      nodeTypeList,
      edgeTypeList,
      originalEdgeTypeList,
      originalNodeTypeList,
    } = graphtypeStore.schemaStore;
    if (!original_graphType) return '';
    const curGraphTypeName = form.getValues('graphTypeName');
    return generateAlterGraphTypeGQL(
      {
        graphTypeName: original_graphType,
        nodeTypeList: originalNodeTypeList,
        edgeTypeList: originalEdgeTypeList,
      },
      {
        graphTypeName: curGraphTypeName,
        nodeTypeList,
        edgeTypeList,
      }
    );
  };

  /**
   * A renamed graph type is a new identity, so its saved layout would be left
   * behind. Carry the arrangement currently on screen over to the new name.
   * Fired without awaiting: the write must not delay leaving the editor.
   */
  const carryLayoutToRenamedGraphType = () => {
    const graphTypeName = graphtypeStore.schemaStore?.graphtypeName;
    const nextGraphTypeName = form.getValues('graphTypeName');
    if (!graphTypeName || !nextGraphTypeName || graphTypeName === nextGraphTypeName) {
      return;
    }

    // Read the canvas before navigating: it is reset when the builder unmounts.
    const canvasLayout = graphtypeStore.canvasStore?.getCanvasLayout() ?? {};

    void graphtypeStore.services.layouts?.migrate?.(graphTypeName, nextGraphTypeName, canvasLayout).catch(() => {});
  };

  const handleCreateGraphType = async () => {
    if (submittingRef.current || readonlyMode) return;
    setSubmissionError('');
    if (!validateSchema()) return;
    let gql: string;
    if (mode === GraphTypeBuildMode.Edit) {
      const conflicts = detectNameConflicts();
      if (conflicts.length > 0) {
        setSubmissionError(t('nameConflictError', { ns: 'graphtype', names: conflicts.join(', ') }));
        return;
      }
      gql = getAlterGraphTypeNgql();
      if (!gql.trim().length) {
        setSubmissionError(t('updateContentEmptyError', { ns: 'graphtype' }));
        return;
      }
    } else {
      gql = getCreateGraphTypeNgql();
    }

    const request = Symbol('graph-type-submission');
    submittingRef.current = request;
    setIsSubmitting(true);
    const fallback = t('graphTypeSubmitFailed', { ns: 'graphtype' });
    try {
      // This page owns persistent feedback; suppress the fetcher's transient toast.
      const res = await graphtypeStore.services.execute(gql, { errTip: false });
      if (submittingRef.current !== request) return;
      if (res?.code !== 0) {
        setSubmissionError(getGraphTypeSubmissionError(res, fallback));
        return;
      }
      message.success(
        t(mode === GraphTypeBuildMode.Edit ? 'alterGraphTypeSuccess' : 'createGraphTypeSuccess', { ns: 'graphtype' })
      );
      if (mode === GraphTypeBuildMode.Edit) carryLayoutToRenamedGraphType();
      onSaved?.(form.getValues('graphTypeName'));
    } catch (error) {
      if (submittingRef.current === request) {
        setSubmissionError(getGraphTypeSubmissionError(error, fallback));
      }
    } finally {
      if (submittingRef.current === request) {
        submittingRef.current = null;
        setIsSubmitting(false);
      }
    }
  };

  const generateThumbnail = (dataUrl: string) =>
    new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(thumbnailMaxWidth / img.width, thumbnailMaxHeight / img.height);
        const scaleBy = 2;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(img.width * ratio * scaleBy, 1);
        canvas.height = Math.max(img.height * ratio * scaleBy, 1);
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });

  const filter = (node: Node) => {
    if (node instanceof SVGElement) {
      const classname = typeof node.className === 'string' ? node.className : node.className.baseVal;
      return (
        !classname?.includes('activeNode') &&
        !classname?.includes('ve-link-points') &&
        !classname?.includes('ve-shdow-path')
      );
    }
    return true;
  };

  const getReactFlowSnapshot = async () => {
    const instance = graphtypeStore.canvasStore?.instance;
    const flowElement = rootRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!instance || !flowElement) return null;

    const nodes = instance.getNodes();
    const edges = instance.getEdges();
    if (!nodes.length && !edges.length) return null;

    const bounds = getNodesBounds(nodes);
    const exportWidth = Math.max(bounds.width, flowElement.clientWidth, 1);
    const exportHeight = Math.max(bounds.height, flowElement.clientHeight, 1);
    const viewport = getViewportForBounds(bounds, exportWidth, exportHeight, 0.1, 4, 0.2);

    try {
      const dataUrl = await domtoimage.toPng(flowElement, {
        width: exportWidth,
        height: exportHeight,
        bgcolor: 'transparent',
        filter,
        style: {
          width: `${exportWidth}px`,
          height: `${exportHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: 'top left',
        },
      });

      return generateThumbnail(dataUrl);
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const handleSaveSketch = () => {
    form.handleSubmit(async (values) => {
      const nodeTypeList = graphtypeStore.schemaStore?.nodeTypeList || [];
      const edgeTypeList = graphtypeStore.schemaStore?.edgeTypeList || [];
      if (!nodeTypeList.length && !edgeTypeList.length) {
        message.error(t('sketchContentEmptyError', { ns: 'graphtype' }));
        return;
      }
      const baseUrl = await getReactFlowSnapshot();
      if (!baseUrl) {
        message.error(t('sketchContentEmptyError', { ns: 'graphtype' }));
        return;
      }
      const params = {
        name: values.graphTypeName,
        // ifNotExists: values.ifNotExists,
        schema: JSON.stringify({
          nodes: nodeTypeList,
          edges: edgeTypeList,
        }),
        snapshot: baseUrl,
      };
      const res = await graphtypeStore.services.sketches?.create(params);
      if (res?.code === 0) {
        message.success(t('sketchSaveSuccess', { ns: 'graphtype' }));
      }
    })();
  };

  const getNgql = async () => {
    let ngql = '';
    switch (mode) {
      case GraphTypeBuildMode.Create:
      case GraphTypeBuildMode.Sketch:
        ngql = getCreateGraphTypeNgql();
        break;
      case GraphTypeBuildMode.Edit: {
        const conflicts = detectNameConflicts();
        if (conflicts.length > 0) {
          message.error(t('nameConflictError', { ns: 'graphtype', names: conflicts.join(', ') }));
        }
        ngql = getAlterGraphTypeNgql();
        break;
      }
      default:
        break;
    }
    setCurNgql(ngql);
  };

  const getBreadCrumbItems = () => [
    { title: t('graphtype', { ns: 'route' }) },
    ...(props.graphTypeName ? [{ title: <TitleEllipsis title={props.graphTypeName} maxWidth={300} /> }] : []),
    ...(mode === GraphTypeBuildMode.Readonly
      ? []
      : [
          {
            title: t(
              mode === GraphTypeBuildMode.Edit ? 'manage' : mode === GraphTypeBuildMode.Sketch ? 'sketch' : 'create',
              { ns: 'route' }
            ),
          },
        ]),
  ];

  // Warn the user before rendering very large graphs that can degrade performance.
  const HEAVY_GRAPH_THRESHOLD = 5000;
  const [hasConfirmedHeavyRender, setHasConfirmedHeavyRender] = useState(false);
  const totalElements =
    (graphtypeStore.schemaStore?.nodeTypeList?.length || 0) + (graphtypeStore.schemaStore?.edgeTypeList?.length || 0);
  const shouldConfirmHeavyRender = !hasConfirmedHeavyRender && totalElements >= HEAVY_GRAPH_THRESHOLD;
  useEffect(() => {
    setHasConfirmedHeavyRender(false);
  }, [graphtypeStore.schemaStore?.graphtypeName]);

  useEffect(() => {
    if (
      !pendingInvalidItem ||
      curStep !== CreateGraphTypeStep.create ||
      curTab !== CreateFunction.VisualBuilder ||
      shouldConfirmHeavyRender
    ) {
      return;
    }
    // Builder initialization and StrictMode replay reset selection; select after both finish.
    const timeout = window.setTimeout(() => {
      graphtypeStore.canvasStore?.selectItem(pendingInvalidItem);
      setPendingInvalidItem(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [pendingInvalidItem, curStep, curTab, shouldConfirmHeavyRender]);

  return (
    <ContentContainer ref={rootRef}>
      <Box display="flex" justifyContent="space-between">
        <BreadCrumbs
          onBack={() => {
            onBack?.();
          }}
          items={getBreadCrumbItems()}
          slotProps={{
            container: {
              sx: { mb: 2 },
            },
          }}
        />
        {readonlyMode && (
          <Button
            variant="outlined"
            startIcon={<EditFilled />}
            onClick={() => {
              const { graphTypeName } = params;
              if (!graphTypeName) return;
              onEdit?.(graphTypeName);
            }}
          >
            {t('editGraphType', { ns: 'graphtype' })}
          </Button>
        )}
        {mode === GraphTypeBuildMode.Edit && (
          <Button
            variant="outlined"
            startIcon={<CloseFilled color="error" />}
            color="error"
            onClick={() => {
              const { graphTypeName } = params;
              if (!graphTypeName) return;
              onView?.(graphTypeName);
            }}
          >
            {t('cancelEditGraphType', { ns: 'graphtype' })}
          </Button>
        )}
      </Box>
      {submissionError && (
        <Alert severity="error" sx={{ mb: 2, flexShrink: 0 }}>
          {submissionError}
        </Alert>
      )}
      <StepContainer display={curStep === CreateGraphTypeStep.create ? 'flex' : 'none'}>
        <Box display="flex" alignItems="center" position="relative">
          {!readonlyMode && (
            <ActionContainer sx={{ position: 'absolute', left: 0, top: 0 }}>
              <FormContainer
                formContext={form}
                handleSubmit={(e) => {
                  e.preventDefault();
                  handeNextClick();
                }}
                FormProps={{
                  style: {
                    width: '100%',
                  },
                }}
              >
                <TextFieldElement
                  label={t('graphTypeName', { ns: 'graphtype' })}
                  name="graphTypeName"
                  required
                  size="small"
                  fullWidth
                  sx={{ width: 220 }}
                  inputProps={{ disabled: curStep === CreateGraphTypeStep.preview }}
                />
              </FormContainer>
            </ActionContainer>
          )}
          <Container maxWidth="md" sx={{ justifyContent: 'center', display: 'flex' }}>
            <ButtonGroup
              sx={{
                height: '36px',
              }}
            >
              {FunctionTabs.map((tab) => (
                <GroupButton active={curTab === tab.type} key={tab.type} onClick={() => setCurTab(tab.type)}>
                  {tab.name}
                </GroupButton>
              ))}
            </ButtonGroup>
          </Container>
        </Box>
        <CreateGraphContainer
          sx={{
            height: 'calc(100% - 48px)',
            display: curTab === CreateFunction.VisualBuilder ? 'block' : 'none',
            mt: 2,
          }}
        >
          {shouldConfirmHeavyRender ? (
            <MassiveGraphConfirmMask
              nodesCount={graphtypeStore.schemaStore?.nodeTypeList?.length || 0}
              edgesCount={graphtypeStore.schemaStore?.edgeTypeList?.length || 0}
              onConfirm={() => setHasConfirmedHeavyRender(true)}
            />
          ) : (
            <VisualBuilder key={params.graphTypeName} />
          )}
        </CreateGraphContainer>
        {curTab === CreateFunction.NodeType && (
          <TableContainer>
            <NodeTypeTable readonly={readonlyMode} />
          </TableContainer>
        )}
        {curTab === CreateFunction.EdgeType && (
          <TableContainer>
            <EdgeTypeTable readonly={readonlyMode} />
          </TableContainer>
        )}
        {curTab === CreateFunction.Label && (
          <TableContainer>
            <LabelTable />
          </TableContainer>
        )}
      </StepContainer>
      {curStep === CreateGraphTypeStep.preview && <Preview ngql={curNgql} />}
      {!readonlyMode && (
        <FooterContainer sx={{ zIndex: theme.zIndex.drawer }}>
          {curStep === CreateGraphTypeStep.create &&
            curTab === CreateFunction.VisualBuilder &&
            graphtypeStore.services.sketches && (
              <Tooltip title={t('saveAsSketchHelp', { ns: 'graphtype' })} describeChild arrow>
                <Button variant="text" sx={{ mr: '10px' }} onClick={handleSaveSketch}>
                  {t('saveAsSketch', { ns: 'graphtype' })}
                </Button>
              </Tooltip>
            )}
          <Button
            disabled={curStep === CreateGraphTypeStep.create || isSubmitting}
            variant="outlined"
            onClick={handlePreviousClick}
            sx={{ width: '120px' }}
          >
            {t('previous', { ns: 'graphtype' })}
          </Button>
          {curStep === CreateGraphTypeStep.create && (
            <Button variant="contained" sx={{ ml: '10px', width: '120px' }} onClick={handeNextClick}>
              {t('preview', { ns: 'graphtype' })}
            </Button>
          )}
          {curStep === CreateGraphTypeStep.preview && (
            <Button
              variant="contained"
              sx={{ ml: '10px', minWidth: '120px' }}
              onClick={handleCreateGraphType}
              loading={isSubmitting}
            >
              {(mode === GraphTypeBuildMode.Create || mode === GraphTypeBuildMode.Sketch) &&
                t('createGraphType', { ns: 'graphtype' })}
              {mode === 'edit' && t('commitEdit', { ns: 'graphtype' })}
            </Button>
          )}
        </FooterContainer>
      )}
    </ContentContainer>
  );
}

export default observer(GraphTypeBuilder);
