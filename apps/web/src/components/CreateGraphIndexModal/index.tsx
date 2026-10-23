import { Box, FormControlLabel, Radio, RadioGroup, Tooltip, useTheme } from '@mui/material';
import { HelpCircleOutline } from '@vesoft-inc/icons';
import { Modal } from '@vesoft-inc/ui-components';
import { useEffect, useState } from 'react';
import type { FieldValues, Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form-mui';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import FormNormalIndex, { CreateGraphIndexFormValues, GraphTypeElementOption } from './FormNormalIndex';
import FormVectorIndex, { CreateGraphVectorIndexFormValues } from './FormVectorIndex';
import FormSpatialIndex, { CreateGraphSpatialIndexFormValues } from './FormSpatialIndex';
import FormFulltextIndex, { CreateGraphFulltextIndexFormValues } from './FormFulltextIndex';
import FormVertexCentricIndex, { CreateGraphVertexCentricIndexFormValues } from './FormVertexCentricIndex';
import { execGql } from '@studio/services';
import { useModal } from '@studio/stores/useModal';
import { schemaStore } from '@studio/stores/session';
import { EdgeDirectionType, GraphEntityType, SortType } from '@vesoft-inc/utils';
import { extractEdgeByEdgeTypeName } from '@studio/utils';

const typedZodResolver = <TFieldValues extends FieldValues>(schema: unknown) =>
  zodResolver(schema as z.ZodType<FieldValues, FieldValues>) as unknown as Resolver<TFieldValues>;

export const CreateGraphIndexModal = ({
  open,
  graphName,
  onOk,
  onCancel,
}: {
  open: boolean;
  graphName: string;
  onOk?: () => void;
  onCancel?: () => void;
}) => {
  const theme = useTheme();
  const { t } = useTranslation(['graph', 'common']);
  const { message } = useModal();

  const [entities, setEntities] = useState<GraphTypeElementOption[]>([]);
  useEffect(() => {
    if (!open) return;

    schemaStore.getEntityTypeInfoByGraphName(graphName).then((res) => {
      setEntities(res as GraphTypeElementOption[]);
    });
  }, [open]);

  const formForNormalIndex = useForm<CreateGraphIndexFormValues>({
    resolver: typedZodResolver<CreateGraphIndexFormValues>(
      z.object({
        indexName: z.string().nonempty({ message: '' }),
        on: z.object({
          entity_type: z.string().nonempty(),
          type_name: z.string().nonempty(),
          indexProperties: z
            .array(
              z.object({
                name: z.string().nonempty(),
                sort: z.enum(SortType),
              })
            )
            .min(1),
        }),
      })
    ),
  });
  const formForVectorIndex = useForm<CreateGraphVectorIndexFormValues>({
    resolver: typedZodResolver<CreateGraphVectorIndexFormValues>(
      z.object({
        indexName: z.string().nonempty({ message: '' }),
        on: z.object({
          entity_type: z.string().nonempty({ message: '' }),
          type_name: z.string().nonempty({ message: '' }),
          propName: z.string({ message: '' }).nonempty({ message: '' }),
          metrics: z.object({
            DIM: z.number().min(1),
            // METRIC: z.string().min(1),
            // TYPE: z.string().min(1),
            // NLIST: z.number().optional(),
            // TRAINSIZE: z.number().optional(),
            // MAX_DEGREE: z.number().optional(),
            // EFCONSTRUCTION: z.number().optional(),
            // CAPACITY: z.number().optional(),
          }),
        }),
      })
    ),
  });
  const formForSpatialIndex = useForm<CreateGraphSpatialIndexFormValues>({
    resolver: typedZodResolver<CreateGraphSpatialIndexFormValues>(
      z.object({
        indexName: z.string().nonempty({ message: '' }),
        on: z.object({
          entity_type: z.string().nonempty({ message: '' }),
          type_name: z.string().nonempty({ message: '' }),
          propName: z.string({ message: '' }).nonempty({ message: '' }),
          s2_max_level: z.number({ error: '' }).min(1, { error: '' }).max(30, { error: '' }),
          s2_max_cells: z.number({ error: '' }).min(1, { error: '' }).max(256, { error: '' }),
        }),
      })
    ),
  });
  const formForFulltextIndex = useForm<CreateGraphFulltextIndexFormValues>({
    resolver: typedZodResolver<CreateGraphFulltextIndexFormValues>(
      z.object({
        indexName: z.string().nonempty({ message: '' }),
        on: z.object({
          entity_type: z.string().nonempty({ message: '' }),
          type_name: z.string().nonempty({ message: '' }),
          propName: z.string({ message: '' }).nonempty({ message: '' }),
        }),
      })
    ),
  });
  const formForVertexCentricIndex = useForm<CreateGraphVertexCentricIndexFormValues>({
    resolver: typedZodResolver<CreateGraphVertexCentricIndexFormValues>(
      z.object({
        indexName: z.string().nonempty({ message: '' }),
        on: z.object({
          entity_type: z.string().nonempty({ message: '' }),
          type_name: z.string().nonempty({ message: '' }),
          anchor: z.enum(['_src', '_dst']),
          indexProperties: z
            .array(
              z.object({
                name: z.string().nonempty({ message: '' }),
                sort: z.enum(SortType),
              })
            )
            .min(1),
        }),
      })
    ),
  });

  type IndexTab = 'normal' | 'vertexCentric' | 'vector' | 'spatial' | 'fulltext';
  const [currentTab, setCurrentTab] = useState<IndexTab>('normal');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmitForNormalIndex = async () => {
    const { indexName, on } = formForNormalIndex.getValues();
    const createIndexGql = `USE \`${graphName}\` CREATE INDEX \`${indexName}\` ON ${on.entity_type} \`${on.type_name}\` (${(on.indexProperties || []).map((property) => `\`${property.name}\` ${property.sort}`).join(', ')})`;
    const res = await execGql(createIndexGql);
    if (res.code === 0) {
      message.success(t('createIndexSuccess', { ns: 'graph' }));
      onOk?.();
    }
  };
  const handleSubmitForVectorIndex = async () => {
    const { indexName, on } = formForVectorIndex.getValues();
    const createIndexGql = `USE \`${graphName}\` CREATE VECTOR INDEX \`${indexName}\` ON ${on.entity_type} \`${on.type_name}\`::\`${on.propName}\` OPTIONS {${(
      Object.keys(on.metrics || {}) || []
    )
      .filter((key) => on.metrics[key as keyof typeof on.metrics])
      .map((key) => `${key}: ${on.metrics[key as keyof typeof on.metrics]}`)
      .join(', ')}}`;
    const res = await execGql(createIndexGql);
    if (res.code === 0) {
      message.success(t('createIndexSuccess', { ns: 'graph' }));
      onOk?.();
    }
  };
  const handleSubmitForSpatialIndex = async () => {
    const { indexName, on } = formForSpatialIndex.getValues();
    const createIndexGql = `USE \`${graphName}\` CREATE SPATIAL INDEX \`${indexName}\` ON ${on.entity_type} \`${on.type_name}\`(\`${on.propName}\`, s2_max_level = ${on.s2_max_level}, s2_max_cells = ${on.s2_max_cells})`;
    const res = await execGql(createIndexGql);
    if (res.code === 0) {
      message.success(t('createIndexSuccess', { ns: 'graph' }));
      onOk?.();
    }
  };
  const handleSubmitForFulltextIndex = async () => {
    const { indexName, on } = formForFulltextIndex.getValues();
    const createIndexGql = `USE \`${graphName}\` CREATE FULLTEXT INDEX \`${indexName}\` ON ${on.entity_type} ${on.type_name}(\`${on.propName}\`)`;
    const res = await execGql(createIndexGql);
    if (res.code === 0) {
      message.success(t('createIndexSuccess', { ns: 'graph' }));
      onOk?.();
    }
  };
  const handleSubmitForVertexCentricIndex = async () => {
    const { indexName, on } = formForVertexCentricIndex.getValues();
    if (on.entity_type !== GraphEntityType.Edge) {
      message.error(t('vertexCentricIndex.onlyEdgeSupported', { ns: 'graph' }));
      return;
    }
    const edgeInfo = on.type_pattern ? extractEdgeByEdgeTypeName(on.type_pattern) : undefined;
    if (!edgeInfo) {
      message.error(t('vertexCentricIndex.directionParseNotSupported', { ns: 'graph' }));
      return;
    }
    if (edgeInfo.direction === EdgeDirectionType.Undirected) {
      message.error(t('vertexCentricIndex.undirectedEdgeNotSupported', { ns: 'graph' }));
      return;
    }

    const propertyClauses = (on.indexProperties || [])
      .map((property) => `\`${property.name}\` ${property.sort}`)
      .join(', ');
    const createIndexGql = `USE \`${graphName}\` CREATE INDEX \`${indexName}\` ON EDGE \`${on.type_name}\` (${on.anchor}${propertyClauses ? `, ${propertyClauses}` : ''})`;
    const res = await execGql(createIndexGql);
    if (res.code === 0) {
      message.success(t('createIndexSuccess', { ns: 'graph' }));
      onOk?.();
    }
  };

  const handleSubmit = async () => {
    let isValid = false;
    switch (currentTab) {
      case 'normal':
        isValid = await formForNormalIndex.trigger();
        break;
      case 'vertexCentric':
        isValid = await formForVertexCentricIndex.trigger();
        break;
      case 'vector':
        isValid = await formForVectorIndex.trigger();
        break;
      case 'spatial':
        isValid = await formForSpatialIndex.trigger();
        break;
      case 'fulltext':
        isValid = await formForFulltextIndex.trigger();
        break;
    }
    if (!isValid) {
      return;
    }
    setIsCreating(true);
    switch (currentTab) {
      case 'normal':
        await handleSubmitForNormalIndex();
        break;
      case 'vertexCentric':
        await handleSubmitForVertexCentricIndex();
        break;
      case 'vector':
        await handleSubmitForVectorIndex();
        break;
      case 'spatial':
        await handleSubmitForSpatialIndex();
        break;
      case 'fulltext':
        await handleSubmitForFulltextIndex();
        break;
    }
    setIsCreating(false);
  };

  return (
    <Modal
      title={t('createIndex', { ns: 'graph' })}
      open={open}
      slotProps={{
        footer: {
          onOk: () => handleSubmit(),
          okText: isCreating ? '' : t('create', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
          slotProps: {
            cancelButton: {
              disabled: isCreating,
            },
            okButton: {
              startIcon: null,
              loading: isCreating,
              // disabled: !formForNormalIndex.formState.isValid,
            },
          },
        },
      }}
      onCancel={onCancel}
    >
      <Box sx={{ padding: `${theme.spacing(1)} ${theme.spacing(1)} 0` }}>
        <Box sx={{ mb: 3 }}>
          <Box>
            <strong>{t('indexType', { ns: 'graph' })}</strong>
          </Box>
          <Box sx={{ mb: 1 }}>
            <RadioGroup
              row
              value={currentTab}
              name="indexType"
              onChange={(e) => {
                setCurrentTab(e.target.value as IndexTab);
              }}
              sx={{
                gap: '12px',
              }}
            >
              <FormControlLabel
                value="normal"
                control={<Radio size="small" />}
                label={t('normalIndex.title', { ns: 'graph' })}
                sx={{ marginRight: 0 }}
              />
              <Box display="flex" alignItems="center" gap="4px">
                <FormControlLabel
                  value="vertexCentric"
                  control={<Radio size="small" />}
                  label={t('vertexCentricIndex.title', { ns: 'graph' })}
                  sx={{ marginRight: 0 }}
                />
                <Tooltip title={t('vertexCentricIndex.description', { ns: 'graph' })} placement="top">
                  <HelpCircleOutline fontSize="small" color="action" />
                </Tooltip>
              </Box>
              <Box display="flex" alignItems="center" gap="4px">
                <FormControlLabel
                  value="vector"
                  control={<Radio size="small" />}
                  label={t('vectorIndex.title', { ns: 'graph' })}
                  sx={{ marginRight: 0 }}
                />
                <Tooltip title={t('vectorIndex.description')} placement="top">
                  <HelpCircleOutline fontSize="small" color="action" />
                </Tooltip>
              </Box>
              <Box display="flex" alignItems="center" gap="4px">
                <FormControlLabel
                  value="spatial"
                  control={<Radio size="small" />}
                  label={t('spatialIndex.title', { ns: 'graph' })}
                  sx={{ marginRight: 0 }}
                />
                <Tooltip title={t('spatialIndex.description')} placement="top">
                  <HelpCircleOutline fontSize="small" color="action" />
                </Tooltip>
              </Box>
              <Box display="flex" alignItems="center" gap="4px">
                <FormControlLabel
                  value="fulltext"
                  control={<Radio size="small" />}
                  label={t('fulltextIndex.title', { ns: 'graph' })}
                  sx={{ marginRight: 0 }}
                />
                <Tooltip title={t('fulltextIndex.description')} placement="top">
                  <HelpCircleOutline fontSize="small" color="action" />
                </Tooltip>
              </Box>
            </RadioGroup>
          </Box>
          {currentTab === 'normal' && <FormNormalIndex form={formForNormalIndex} entities={entities} />}
          {currentTab === 'vertexCentric' && (
            <FormVertexCentricIndex form={formForVertexCentricIndex} entities={entities} />
          )}
          {currentTab === 'vector' && <FormVectorIndex form={formForVectorIndex} entities={entities} />}
          {currentTab === 'spatial' && <FormSpatialIndex form={formForSpatialIndex} entities={entities} />}
          {currentTab === 'fulltext' && <FormFulltextIndex form={formForFulltextIndex} entities={entities} />}
        </Box>
      </Box>
    </Modal>
  );
};

export default CreateGraphIndexModal;
