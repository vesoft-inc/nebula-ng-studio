import { observer } from 'mobx-react-lite';
import { useRef } from 'react';
import Box from '@mui/material/Box';
import ModalStore from './ModalStore';
import Modal from './Modal';
import { MessageBox } from './GlobalMessage';

const GlobalModal = observer((props: { store: ModalStore }) => {
  const { store } = props;
  const { open, modalConfig, message } = store;
  const container = useRef(undefined);
  return (
    <Box ref={container}>
      <Modal {...modalConfig} open={open} container={container.current} onCancel={modalConfig.onCancel || store.hide} />
      <MessageBox store={message} />
    </Box>
  );
});

export default GlobalModal;
