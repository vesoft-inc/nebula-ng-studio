import { Button, type SxProps, type ButtonProps, type Theme } from '@mui/material';

interface IProps extends ButtonProps {
  active: boolean;
}

const activeSx: SxProps<Theme> = {
  minWidth: '100px !important',
  backgroundColor: (theme) => theme.palette.vesoft.v2.bg3,
  border: (theme) => `1px solid ${theme.palette.vesoft.themeColor1}`,
  color: (theme) => theme.palette.vesoft.themeColor1,
  boxShadow: 'none',
  fontWeight: 'bold',
  '&:hover': {
    backgroundColor: (theme) => theme.palette.vesoft.themeColor5,
    color: (theme) => theme.palette.vesoft.themeColor1,
    border: (theme) => `1px solid ${theme.palette.vesoft.themeColor1}`,
    boxShadow: 'none',
  },
};

const commonSx: SxProps<Theme> = {
  minWidth: '100px !important',
  border: (theme) => `1px solid ${theme.palette.vesoft.themeColor1}`,
};

function GroupButton(props: IProps) {
  const { active, children, ...rest } = props;
  return (
    <Button sx={active ? activeSx : commonSx} variant={active ? 'contained' : 'outlined'} {...rest}>
      {props.children}
    </Button>
  );
}

export default GroupButton;
