import { CloseFilled } from '@vesoft-inc/icons';
import {
  DialogContentProps,
  DialogProps,
  DialogTitle,
  DialogTitleProps,
  IconButton,
  IconButtonProps,
} from '@mui/material';
import { BootstrapDialog, ModalContent } from './styles';
import ModalFooter, { ModalFooterProps } from './ModalFooter';

export interface ModalProps extends Omit<DialogProps, 'open' | 'title' | 'content'> {
  open: boolean;
  title: React.ReactNode;
  closeIcon?: boolean;
  content?: React.ReactNode;
  footer?: React.ReactNode;
  onOk?: () => void;
  onCancel?: () => void;
  container?: Element | (() => Element | null) | null | undefined;
  slots?: DialogProps['slots'] &
    Partial<{
      closeIcon: React.ReactNode;
    }>;

  slotProps?: DialogProps['slotProps'] &
    Partial<{
      title: DialogTitleProps;
      closeButton: IconButtonProps;
      content: DialogContentProps;
      footer: ModalFooterProps;
    }>;
}

const Modal = (props: ModalProps) => {
  const {
    title,
    content,
    open,
    footer,
    onOk,
    onCancel,
    slotProps,
    slots,
    container,
    closeIcon = true,
    ...rest
  } = props;

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <BootstrapDialog
      open={open}
      container={container}
      onClose={handleCancel}
      slots={{
        root: slots?.root,
        backdrop: slots?.backdrop,
      }}
      slotProps={{
        root: slotProps?.root,
        backdrop: slotProps?.backdrop,
      }}
      sx={{
        '& .MuiDialog-paper': {
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
        },
      }}
      {...rest}
    >
      {title && <DialogTitle {...slotProps?.title}>{title}</DialogTitle>}
      {closeIcon && (
        <IconButton
          aria-label="close"
          onClick={handleCancel}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
          {...slotProps?.closeButton}
        >
          {slots?.closeIcon || <CloseFilled fontSize="small" />}
        </IconButton>
      )}
      {content ? (
        content
      ) : (
        <>
          <ModalContent {...slotProps?.content}>{props.children}</ModalContent>
          {footer === false
            ? null
            : footer || <ModalFooter onOk={onOk} onCancel={handleCancel} {...slotProps?.footer} />}
        </>
      )}
    </BootstrapDialog>
  );
};

export default Modal;
