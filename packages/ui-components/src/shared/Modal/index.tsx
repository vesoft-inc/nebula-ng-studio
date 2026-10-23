import Modal, { type ModalProps } from './Modal';
import ModalStore from './ModalStore';
import GlobalModal from './GlobalModal';

export const modalStore = new ModalStore();

export { Modal, GlobalModal, ModalStore };
export type { ModalProps };
