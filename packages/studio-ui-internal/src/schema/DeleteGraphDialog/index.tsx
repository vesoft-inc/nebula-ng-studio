import { Modal } from '../../shared/index';
import { Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface DeleteGraphModalProps {
  open: boolean;
  onCancel?: () => void;
  onOk?: () => void;
}

const DeleteGraphModal = (props: DeleteGraphModalProps) => {
  const { open, onCancel, onOk } = props;
  const theme = useTheme();
  const { t } = useTranslation(['graphtype', 'common']);

  return (
    <Modal
      title={t('deleteGraph', { ns: 'common' })}
      slotProps={{
        footer: {
          okText: t('delete', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
          onOk: () => {
            onOk?.();
          },
          slotProps: {
            okButton: {
              color: 'error',
            },
          },
        },
      }}
      open={open}
      onCancel={onCancel}
    >
      <Box sx={{ padding: `${theme.spacing(0.5)} ${theme.spacing(2)}` }}>
        {t('confirmDeleteGrpah', { ns: 'common' })}
      </Box>
    </Modal>
  );
};

export default DeleteGraphModal;
