import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import { Modal } from '@vesoft-inc/ui-components';
import type { GraphWorkspaceStore } from '@studio/stores/graph/workspace';
import type { GraphEditDeleteModal } from '@studio/stores/graph/graphEdit';
import EntityEditModal from './EntityEditModal';

function DeleteConfirmModal({
  explorerItem,
  modal,
}: {
  explorerItem: GraphWorkspaceStore;
  modal: GraphEditDeleteModal;
}) {
  const { graphEdit } = explorerItem;
  const { t } = useTranslation(['common', 'explorer']);

  return (
    <Modal
      open
      title={t('deleteEntityConfirmTitle', { ns: 'explorer' })}
      onCancel={() => !graphEdit.submitting && graphEdit.closeModal()}
      onOk={graphEdit.confirmDelete}
      slotProps={{
        content: { sx: { width: 420, maxWidth: '80vw' } },
        footer: {
          okText: t('delete', { ns: 'explorer' }),
          cancelText: t('cancel', { ns: 'common' }),
          slotProps: { okButton: { loading: graphEdit.submitting, color: 'error' } },
        },
      }}
    >
      <Box display="flex" flexDirection="column" gap={1}>
        <Typography fontSize={14}>
          {t('deleteEntityConfirmContent', {
            ns: 'explorer',
            nodes: modal.nodes.length,
            links: modal.links.length,
          })}
        </Typography>
        <Typography fontSize={12} sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }}>
          {t('deleteEntityConfirmWarning', { ns: 'explorer' })}
        </Typography>
      </Box>
    </Modal>
  );
}

function GraphEditDialogs({ explorerItem }: { explorerItem: GraphWorkspaceStore }) {
  const { modal } = explorerItem.graphEdit;
  if (!modal) return null;
  if (modal.kind === 'delete') {
    return <DeleteConfirmModal explorerItem={explorerItem} modal={modal} />;
  }
  return <EntityEditModal key={`${modal.kind}-${modal.mode}`} explorerItem={explorerItem} />;
}

export default observer(GraphEditDialogs);
