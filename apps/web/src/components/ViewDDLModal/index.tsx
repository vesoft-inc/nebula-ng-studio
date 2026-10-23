import { styled } from '@mui/material';
import { Modal } from '@vesoft-inc/ui-components';
import { Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

import GQLEditorLite from '@studio/components/GQLEditorLite';
import { useModal } from '@studio/stores/useModal';
import { getVesoftBorder } from '@studio/utils';
import copy from 'copy-to-clipboard';

interface ViewDDLModalProps {
  open: boolean;
  ddl: string;
  onCancel: () => void;
}

const EditorWrapper = styled(Box)`
  border: ${getVesoftBorder};
  position: relative;
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  height: 400px;
  resize: vertical;
  overflow: hidden;
`;

const ViewDDLModal = (props: ViewDDLModalProps) => {
  const { open, onCancel, ddl } = props;
  const theme = useTheme();
  const { message } = useModal();

  const { t } = useTranslation(['graphtype', 'common']);

  return (
    <Modal
      title={t('viewDDL', { ns: 'graphtype' })}
      open={open}
      onCancel={onCancel}
      slotProps={{
        content: {
          sx: {
            width: 800,
          },
        },
        footer: {
          okText: t('copy', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
        },
      }}
      onOk={() => {
        copy(ddl);
        message.success(t('copySuccess', { ns: 'common' }));
      }}
      PaperProps={{
        sx: {
          width: 800,
          maxWidth: 'unset',
        },
      }}
    >
      <Box sx={{ padding: `${theme.spacing(2)} ${theme.spacing(3)}` }}>
        <EditorWrapper>
          <GQLEditorLite value={ddl} readOnly />
        </EditorWrapper>
      </Box>
    </Modal>
  );
};

export default ViewDDLModal;
