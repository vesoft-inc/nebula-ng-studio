import { isValidElement, useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import List from '@mui/material/List';
import { TransitionGroup } from 'react-transition-group';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Snackbar from '@mui/material/Snackbar';
import MessageStore, { AlertMessage } from './store';

function AutoHideAlert({ message }: { message: AlertMessage }) {
  const [hovering, setHovering] = useState(false);
  const isNotNullish = useCallback((value: unknown) => value !== undefined && value !== null, []);

  useEffect(() => {
    const { duration } = message;
    if (duration === null || duration! <= 0 || hovering) {
      return;
    }
    const timer = setTimeout(() => message.onClose?.(), duration);
    return () => clearTimeout(timer);
  }, [hovering]);

  const { type, icon, title, content, onClose, alertProps } = message;
  const inSx = alertProps?.sx;
  const defaultSx = {
    mb: 2,
    display: 'inline-flex',
    textAlign: 'initial',
    wordBreak: 'normal',
    whiteSpace: 'pre-wrap',
  };

  return (
    <Alert
      {...alertProps}
      onClose={onClose}
      severity={type}
      icon={icon}
      onMouseEnter={(e) => {
        setHovering(true);
        alertProps?.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovering(false);
        alertProps?.onMouseLeave?.(e);
      }}
      sx={Array.isArray(inSx) ? [defaultSx, ...inSx] : [defaultSx, alertProps?.sx || false]}
    >
      {isNotNullish(title) && (isValidElement(title) ? title : <AlertTitle>{title}</AlertTitle>)}
      {content}
    </Alert>
  );
}

export const MessageBox = observer(function MessageBoxComp({ store }: { store: MessageStore }) {
  const { list: messages } = store;
  return (
    <Snackbar open={!!messages.length} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
      <List sx={{ width: '100%' }}>
        <TransitionGroup>
          {messages.map((msg) => (
            <Collapse key={msg.id} sx={{ textAlign: 'center' }}>
              <AutoHideAlert message={msg} />
            </Collapse>
          ))}
        </TransitionGroup>
      </List>
    </Snackbar>
  );
});

export { AlertMessage, MessageStore };
