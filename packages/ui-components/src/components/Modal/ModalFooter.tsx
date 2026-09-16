import { Button, ButtonProps, CircularProgress, DialogActions, DialogActionsProps } from '@mui/material';

export interface ModalFooterProps extends DialogActionsProps {
  cancelText?: React.ReactNode;
  okText?: React.ReactNode;
  actions?: React.ReactNode;
  onCancel?: () => void;
  onOk?: () => void;
  slots?: Partial<{
    actionPrefix: React.ReactNode;
  }>;
  slotProps?: Partial<{
    actions: DialogActionsProps;
    cancelButton: ButtonProps;
    okButton: ButtonProps & { loading?: boolean };
    extraActions: React.ReactNode;
  }>;
}

function ModalFooter(props: ModalFooterProps) {
  const { onOk, onCancel, cancelText = 'Cancel', okText = 'Ok', slots, slotProps, actions } = props;
  return (
    <DialogActions {...slotProps?.actions}>
      {slots?.actionPrefix}
      {actions ? (
        actions
      ) : (
        <>
          <Button onClick={onCancel} variant="outlined" {...slotProps?.cancelButton}>
            {cancelText}
          </Button>
          <Button
            variant="contained"
            onClick={onOk}
            disabled={slotProps?.okButton?.loading}
            startIcon={slotProps?.okButton?.loading ? <CircularProgress size={14} color="inherit" /> : undefined}
            {...slotProps?.okButton}
          >
            {okText}
          </Button>
          {slotProps?.extraActions}
        </>
      )}
    </DialogActions>
  );
}

export default ModalFooter;
