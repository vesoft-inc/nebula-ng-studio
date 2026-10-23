import { Modal } from '../../shared/index';
import { Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface DeleteGraphTypeModalProps {
  open: boolean;
  onCancel?: () => void;
  onOk?: () => void;
}

const DeleteGraphTypeModal = (props: DeleteGraphTypeModalProps) => {
  const { open, onCancel, onOk } = props;
  const theme = useTheme();

  const { t } = useTranslation(['graphtype', 'common']);

  return (
    <Modal
      title={t('deleteGraphType', { ns: 'graphtype' })}
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
        {t('confirmDeleteGraphType', { ns: 'graphtype' })}
      </Box>
    </Modal>
  );
};

export default DeleteGraphTypeModal;
