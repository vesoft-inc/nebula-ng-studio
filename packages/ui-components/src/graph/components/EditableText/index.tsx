import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TextField, Typography, Popover, MenuItem, Tooltip } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

interface IProps {
  text: string;
  editable?: boolean;
  onComplete?: (text: string) => Promise<void>;
  onDelete?: () => void;
  // withTooltip?: boolean;
}

const EditableText: React.FC<IProps> = (props) => {
  const { text, onComplete, onDelete, editable = false } = props;
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(text);
  const inputRef = useRef<HTMLInputElement | undefined>(undefined);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { t } = useTranslation(['explorer']);
  const onInputBlur = useCallback(
    async (inputValue: string) => {
      editable && text !== inputValue && (await onComplete?.(inputValue));
      setIsEditing(false);
    },
    [onComplete, text, editable]
  );

  useEffect(() => {
    isEditing && inputRef.current?.focus();
  }, [isEditing]);

  const handleContextMenu = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (!editable) return;
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      {isEditing ? (
        <TextField
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.trim())}
          onBlur={() => onInputBlur(inputValue)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onInputBlur(inputValue);
            }
            if (event.key === 'Escape') {
              setIsEditing(false);
              setInputValue(text);
            }
          }}
          inputProps={{
            maxLength: 30,
            ref: inputRef,
            size: 'small',
          }}
          sx={{
            fontSize: 12,
          }}
          fullWidth
        />
      ) : (
        <Tooltip title={text} placement="left" arrow>
          <Typography
            component="span"
            onContextMenu={handleContextMenu}
            sx={{
              width: '100%',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textTransform: 'none',
              fontSize: 12,
              '&:hover': {
                color: (theme) => theme.palette.vesoft.v2.primary3,
              },
            }}
          >
            {text}
          </Typography>
        </Tooltip>
      )}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <MenuItem
          onClick={() => {
            setIsEditing(true);
            handleClose();
          }}
          sx={{
            width: 80,
            color: (theme) => theme.palette.vesoft.v2.primary3,
          }}
        >
          {t('edit', { ns: 'explorer' })}
        </MenuItem>
        {onDelete && (
          <MenuItem
            onClick={() => {
              onDelete();
              handleClose();
            }}
            sx={{
              width: 80,
              color: (theme) => theme.palette.vesoft.v2.error2,
            }}
          >
            {t('delete', { ns: 'explorer' })}
          </MenuItem>
        )}
      </Popover>
    </>
  );
};

export default observer(EditableText);
