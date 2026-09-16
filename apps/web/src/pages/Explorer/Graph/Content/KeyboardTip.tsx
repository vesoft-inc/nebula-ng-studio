import { Box, IconButton, Popover, Typography } from '@mui/material';
import { KeyboardOutline } from '@vesoft-inc/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const popoverId = 'keyboard-tip-popover';

const KeyboardTip = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const open = Boolean(anchorEl);
  const { t } = useTranslation(['common']);
  const keyboardInfo = useMemo(
    () => [
      {
        key: ['Enter'],
        desc: t('keyboardInfo.enter'),
      },
      {
        key: ['Shift', '-'],
        desc: t('keyboardInfo.zoomOut', { ns: 'common' }),
      },
      {
        key: ['Shift', '+'],
        desc: t('keyboardInfo.zoomIn', { ns: 'common' }),
      },
      {
        key: ['⌘/Ctrl', 'Z'],
        desc: t('keyboardInfo.undo', { ns: 'common' }),
      },
      {
        key: ['⌘/Ctrl', 'Shift', 'Z'],
        desc: t('keyboardInfo.redo', { ns: 'common' }),
      },
      {
        key: ['⌘/Ctrl', 'A'],
        desc: t('keyboardInfo.selectAll', { ns: 'common' }),
      },
    ],
    [t]
  );

  return (
    <>
      <IconButton
        aria-describedby={popoverId}
        onClick={handleClick}
        sx={{
          borderRadius: '6px',
          backgroundColor: (theme) => theme.palette.vesoft.background.paper,
          border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider1}`,
          color: (theme) => theme.palette.vesoft.v2.text2,
          height: '32px',
          width: '32px',
          position: 'absolute',
          top: 24,
          left: 24,
          '&:hover': {
            cursor: 'pointer',
            backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
            borderColor: (theme) => theme.palette.vesoft.v2.primary3,
          },
        }}
      >
        <KeyboardOutline fontSize="medium" />
      </IconButton>
      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 50,
          horizontal: 'left',
        }}
      >
        <Box width={320} p={2}>
          {keyboardInfo.map((item, index) => (
            <Box key={index} display="flex" justifyContent="space-between" mb={1}>
              <Typography>{item.key.join(' + ')}</Typography>
              <Typography component="div" minWidth={50} sx={{ textAlign: 'right' }} fontWeight="bold">
                {item.desc}
              </Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
};

export default KeyboardTip;
