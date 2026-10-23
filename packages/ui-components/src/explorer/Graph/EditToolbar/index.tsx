import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Box, Button, Divider, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Delete, EdgeAdd, EditFilled, VertexAdd } from '@vesoft-inc/icons';
import type { GraphWorkspaceStore } from '../../../graph/stores/workspace';
import { ToolIconButton } from '../Header/styles';

const actionButtonSx: SxProps<Theme> = {
  textTransform: 'none',
  backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
  fontSize: 12,
  height: 28,
  minWidth: 'unset',
  px: 1,
};

/** Header entry point: switches the canvas into / out of edit mode. */
export const EditModeToggle = observer(({ explorerItem }: { explorerItem: GraphWorkspaceStore }) => {
  const { graphEdit } = explorerItem;
  const { t } = useTranslation(['explorer']);
  const disabled = !graphEdit.canEdit;
  return (
    <Tooltip title={graphEdit.editMode ? t('exitEditMode', { ns: 'explorer' }) : t('editMode', { ns: 'explorer' })}>
      <span>
        <ToolIconButton
          aria-label="edit-mode"
          disabled={disabled}
          color={graphEdit.editMode ? 'primary' : 'default'}
          onClick={() => graphEdit.toggleEditMode()}
        >
          <EditFilled fontSize="medium" />
        </ToolIconButton>
      </span>
    </Tooltip>
  );
});

/** Floating actions of the edit mode, anchored on the canvas. */
export const EditActionBar = observer(({ explorerItem }: { explorerItem: GraphWorkspaceStore }) => {
  const { graphEdit, graph } = explorerItem;
  const { t } = useTranslation(['explorer']);
  if (!graphEdit.editMode) return null;

  const endpoints = graphEdit.selectedEndpoints;
  const endpointLabel = (node?: { data?: { value?: { type?: string; properties?: Record<string, unknown> } } }) => {
    const value = node?.data?.value;
    if (!value) return '';
    const keys = explorerItem.nodeTypePrimaryKeysMap.get(value.type ?? '');
    const label = keys
      ?.map((key) => value.properties?.[key])
      .filter(Boolean)
      .join(' ');
    return label ? `${value.type} ${label}` : (value.type ?? '');
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={1}
      sx={{
        position: 'absolute',
        top: 24,
        left: 20,
        px: 1,
        py: 0.75,
        borderRadius: '6px',
        backgroundColor: (theme) => theme.palette.vesoft.background.paper,
        border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider1}`,
        boxShadow: (theme) => theme.shadows[2],
      }}
    >
      <Button
        variant="outlined"
        sx={actionButtonSx}
        startIcon={<VertexAdd fontSize="small" />}
        onClick={() => graphEdit.openAddNode()}
      >
        {t('addNode', { ns: 'explorer' })}
      </Button>
      <Button
        variant="outlined"
        sx={actionButtonSx}
        startIcon={<EdgeAdd fontSize="small" />}
        onClick={() => graphEdit.openAddEdge()}
      >
        {t('addEdge', { ns: 'explorer' })}
      </Button>
      <Button
        variant="outlined"
        color="error"
        sx={actionButtonSx}
        startIcon={<Delete fontSize="small" />}
        disabled={!graph.hasEntitySelected}
        onClick={() => graphEdit.openDeleteConfirm()}
      >
        {t('delete', { ns: 'explorer' })}
      </Button>
      <Divider orientation="vertical" flexItem />
      {endpoints ? (
        <Typography fontSize={12} sx={{ color: (theme) => theme.palette.vesoft.v2.text2 }}>
          {t('sourceVertex', { ns: 'explorer' })}: {endpointLabel(endpoints.source)} →{' '}
          {t('targetVertex', { ns: 'explorer' })}: {endpointLabel(endpoints.target)}
        </Typography>
      ) : (
        <Typography fontSize={12} sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }}>
          {t('selectSourceTargetHint', { ns: 'explorer' })}
        </Typography>
      )}
    </Box>
  );
});

export default EditActionBar;
