import { makeAutoObservable, observable } from 'mobx';
import { MessageStore } from './GlobalMessage';
import type { ModalProps } from './Modal';
import { Box, type Theme } from '@mui/material';
import { deepmerge } from '@mui/utils';
import { CheckCircleFilled, ErrorFilled, InfoOutlined, WarningFilled } from '@vesoft-inc/icons';

type ModalConfig = Omit<ModalProps, 'open'>;

type ModalType = 'info' | 'success' | 'warning' | 'error';

type ModalTypeParams = {
  title: React.ReactNode;
  subTitle?: React.ReactNode;
  content: React.ReactNode;
  okText?: string;
  cancelText?: string;
  onOk?: () => void;
  onCancel?: () => void;
  showIcon?: boolean;
};

const ModalTypeInfoMap = {
  info: {
    color: (theme: Theme) => theme.palette.vesoft.v2.primary3,
    icon: <InfoOutlined fontSize="medium" />,
  },
  success: {
    color: (theme: Theme) => theme.palette.vesoft.v2.success2,
    icon: <CheckCircleFilled fontSize="medium" />,
  },
  warning: {
    color: (theme: Theme) => theme.palette.vesoft.v2.warning2,
    icon: <WarningFilled fontSize="medium" />,
  },
  error: {
    color: (theme: Theme) => theme.palette.vesoft.v2.error2,
    icon: <ErrorFilled fontSize="medium" />,
  },
};

const getBaseModalConfig = (type: ModalType, params: ModalTypeParams): ModalConfig => {
  const { title, subTitle, content, onOk, onCancel, okText, cancelText, showIcon = true } = params;
  const { color, icon } = ModalTypeInfoMap[type];
  return {
    title: (
      <Box display="flex" alignItems="center">
        {showIcon && (
          <Box display="flex" alignItems="center" mr={1} color={color}>
            {icon}
          </Box>
        )}
        <Box
          fontSize={16}
          fontWeight={600}
          display="flex"
          alignItems="center"
          color={(theme) => theme.palette.vesoft.v2.text1}
        >
          <Box display="flex" flexDirection="column" gap={1}>
            {title}
            {subTitle && (
              <Box fontSize={14} color={(theme) => theme.palette.vesoft.v2.text2}>
                {subTitle}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    ),
    closeIcon: false,
    children: <Box color={(theme) => theme.palette.vesoft.v2.text2}>{content}</Box>,
    onCancel,
    onOk,
    slotProps: {
      title: {
        sx: {
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
        },
      },
      content: {
        sx: {
          border: 'none',
          width: 480,
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
        },
      },
      footer: {
        okText: okText || 'Confirm',
        cancelText: cancelText || 'Cancel',
        slotProps: {
          actions: {
            sx: {
              padding: (theme: Theme) => `${theme.spacing(2)}px ${theme.spacing(3)}px`,
              backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
            },
          },
          okButton: {
            variant: 'contained',
            color: type === 'error' ? 'error' : 'primary',
          },
          cancelButton: {
            variant: 'outlined',
          },
        },
      },
    },
    sx: {
      '& .MuiDialog-paper': {
        border: '1px solid',
        borderColor: (theme) => theme.palette.vesoft.v2.divider2,
      },
    },
  };
};

class ModalStore {
  open = false;

  modalConfig: ModalConfig = {
    title: 'Modal',
    content: 'Content1',
  };

  message = new MessageStore();

  constructor() {
    makeAutoObservable(this, {
      modalConfig: observable.ref,
      message: observable.ref,
    });
  }

  show = (config: ModalConfig) => {
    this.modalConfig = config;
    this.open = true;
  };

  hide = () => {
    this.open = false;
  };

  severity = (params: ModalTypeParams, opts?: Partial<ModalConfig>) => {
    this.show(deepmerge(getBaseModalConfig('error', params), opts));
  };

  warning = (params: ModalTypeParams, opts?: Partial<ModalConfig>) => {
    this.show(deepmerge(getBaseModalConfig('warning', params), opts));
  };

  info = (params: ModalTypeParams, opts?: Partial<ModalConfig>) => {
    this.show(deepmerge(getBaseModalConfig('info', params), opts));
  };

  success = (params: ModalTypeParams, opts?: Partial<ModalConfig>) => {
    this.show(deepmerge(getBaseModalConfig('success', params), opts));
  };
}

export default ModalStore;
