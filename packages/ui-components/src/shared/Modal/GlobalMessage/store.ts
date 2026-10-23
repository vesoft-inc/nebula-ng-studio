import { makeAutoObservable, observable } from 'mobx';
import type { AlertProps, AlertColor } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';

interface MessageProps {
  type: AlertColor;
  title?: string | number | React.ReactNode;
  content: React.ReactNode;
  icon?: React.ReactNode;
  duration?: number | null;
  alertProps?: Omit<AlertProps, 'severity' | 'icon' | 'onClose'>;
  onClose?: () => void;
}

export class AlertMessage {
  id = uuidv4();
  type: AlertColor;
  /**
   * - string | number
   * `<AlertTitle>{title}</AlertTitle>`
   * - JSX.Element
   * `{title}`
   */
  title: MessageProps['title'];
  content: MessageProps['content'];
  icon: MessageProps['icon'];
  duration: MessageProps['duration'];
  onClose: MessageProps['onClose'];

  alertProps: MessageProps['alertProps'];

  constructor({ type, title, content, duration = 3000, icon, onClose, alertProps }: MessageProps) {
    this.type = type;
    this.title = title;
    this.content = content;
    this.duration = duration;
    this.icon = icon;
    this.onClose = onClose;
    this.alertProps = alertProps;
  }
}

type MethodFun = (content: string, config?: Omit<MessageProps, 'type' | 'content'>) => void;

export default class MessageStore {
  list = observable.array<AlertMessage>([], { deep: false });

  constructor() {
    makeAutoObservable(this);
  }

  open = (props: MessageProps) => {
    const message = new AlertMessage({
      ...props,
      onClose: () => {
        this.delete(message);
        props.onClose?.();
      },
    });
    this.push(message);
  };

  success: MethodFun = (content, config) => this.open({ type: 'success', content, ...config });
  info: MethodFun = (content, config) => this.open({ type: 'info', content, ...config });
  warning: MethodFun = (content, config) => this.open({ type: 'warning', content, ...config });
  error: MethodFun = (content, config) => this.open({ type: 'error', content, ...config });

  push = (message: AlertMessage) => {
    this.list.push(message);
  };

  delete = (message: AlertMessage) => {
    this.list.remove(message);
  };

  clear = () => this.list.clear();
}
