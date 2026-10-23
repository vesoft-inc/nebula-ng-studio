import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Box, MenuItem, TextField, Typography } from '@mui/material';
import { Modal } from '../../../shared/index';
import { GraphEntityType } from '@vesoft-inc/utils';
import type { GraphWorkspaceStore } from '../../../graph/stores/workspace';
import type { GraphEditEdgeModal, GraphEditNodeModal } from '../../../graph/stores/graphEdit';
import PropertyField from './PropertyField';

const VALIDATION_MESSAGE_KEYS = {
  required: 'validation.required',
  invalidInt: 'validation.invalidInt',
  invalidNumber: 'validation.invalidNumber',
  invalidBool: 'validation.invalidBool',
  invalidDate: 'validation.invalidDate',
  invalidTime: 'validation.invalidTime',
  invalidDatetime: 'validation.invalidDatetime',
  invalidLiteral: 'validation.invalidLiteral',
} as const;

const nodeLabel = (
  node: { data?: { value?: { type?: string; properties?: Record<string, unknown> } } },
  primaryKeysMap: Map<string, string[]>
) => {
  const value = node?.data?.value;
  if (!value) return '';
  const keys = primaryKeysMap.get(value.type ?? '');
  const label = keys
    ?.map((key) => value.properties?.[key])
    .filter(Boolean)
    .join(' ');
  return label ? `${value.type} ${label}` : (value.type ?? '');
};

function EntityEditModal({ explorerItem }: { explorerItem: GraphWorkspaceStore }) {
  const { graphEdit } = explorerItem;
  const { t } = useTranslation(['common', 'explorer']);
  const modal = graphEdit.modal as GraphEditNodeModal | GraphEditEdgeModal | undefined;
  const meta = graphEdit.modalEntityMeta;
  const form = useForm<Record<string, string>>({ defaultValues: graphEdit.modalInitialValues });

  // Re-seed the form whenever the dialog target changes (new entity or another type).
  useEffect(() => {
    form.reset(graphEdit.modalInitialValues);
  }, [modal]);

  if (!modal || !meta) return null;

  const entityType = modal.kind === 'node' ? GraphEntityType.Node : GraphEntityType.Edge;
  const isAdd = modal.mode === 'add';
  const isNode = modal.kind === 'node';

  const typeOptions: Array<{ value: string; label: string; reversed?: boolean }> = isAdd
    ? isNode
      ? graphEdit.addableNodeTypes.map((item) => ({ value: item.type_name, label: item.type_name }))
      : graphEdit.getEligibleEdgeTypes().map((option) => ({
          value: option.meta.type_name,
          label: option.meta.type_name,
          reversed: option.reversed,
        }))
    : [];

  const currentOption = typeOptions.find((option) => option.value === modal.typeName);

  const onSubmit = async (values: Record<string, string>) => {
    const result = await graphEdit.submit(values);
    if (!result.ok && result.errors) {
      Object.entries(result.errors).forEach(([name, code]) => {
        if (!code) return;
        form.setError(name, {
          type: 'manual',
          message: t(VALIDATION_MESSAGE_KEYS[code], { ns: 'explorer' }),
        });
      });
    }
  };

  const title = isAdd
    ? isNode
      ? t('addNode', { ns: 'explorer' })
      : t('addEdge', { ns: 'explorer' })
    : t('editProperties', { ns: 'explorer' });

  return (
    <Modal
      open
      title={title}
      onCancel={() => !graphEdit.submitting && graphEdit.closeModal()}
      onOk={form.handleSubmit(onSubmit)}
      slotProps={{
        content: { sx: { width: 420, maxWidth: '80vw' } },
        footer: {
          okText: t('confirm', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
          slotProps: { okButton: { loading: graphEdit.submitting } },
        },
      }}
    >
      <FormProvider {...form}>
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          {isAdd && (
            <TextField
              select
              size="small"
              fullWidth
              label={isNode ? t('nodeType', { ns: 'explorer' }) : t('edgeType', { ns: 'explorer' })}
              value={modal.typeName}
              onChange={(event) => graphEdit.updateModalTypeName(event.target.value)}
            >
              {typeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                  {option.reversed ? ` (${t('edgeDirectionReversed', { ns: 'explorer' })})` : ''}
                </MenuItem>
              ))}
            </TextField>
          )}
          {modal.kind === 'edge' && (
            <Box display="flex" flexDirection="column" gap={0.5}>
              <Typography fontSize={12} sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }}>
                {t('sourceVertex', { ns: 'explorer' })}: {nodeLabel(modal.source, explorerItem.nodeTypePrimaryKeysMap)}
              </Typography>
              <Typography fontSize={12} sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }}>
                {t('targetVertex', { ns: 'explorer' })}: {nodeLabel(modal.target, explorerItem.nodeTypePrimaryKeysMap)}
              </Typography>
              {currentOption?.reversed && (
                <Typography fontSize={12} color="warning.main">
                  {t('edgeDirectionReversedTip', { ns: 'explorer' })}
                </Typography>
              )}
            </Box>
          )}
          {meta.properties.map((property) => (
            <PropertyField
              key={property.property_name}
              property={property}
              entityType={entityType}
              disabled={!isAdd && property.isKey}
            />
          ))}
        </Box>
      </FormProvider>
    </Modal>
  );
}

export default observer(EntityEditModal);
