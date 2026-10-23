import { type Theme } from '@mui/material';
import { Button, type SxProps, type ButtonProps } from '@mui/material';

interface IProps extends ButtonProps {
  active: boolean;
}

const activeSx: SxProps<Theme> = {
  minWidth: '100px !important',
  backgroundColor: (theme: Theme) => theme.palette.vesoft.themeColor5,
  border: (theme: Theme) => `1px solid ${theme.palette.vesoft.themeColor1}`,
  color: (theme: Theme) => theme.palette.vesoft.themeColor1,
  boxShadow: 'none',
  fontWeight: 'bold',
  '&:hover': {
    backgroundColor: (theme: Theme) => theme.palette.vesoft.themeColor5,
    color: (theme: Theme) => theme.palette.vesoft.themeColor1,
    border: (theme: Theme) => `1px solid ${theme.palette.vesoft.themeColor1}`,
    boxShadow: 'none',
  },
};

const commonSx: SxProps<Theme> = {
  minWidth: '100px !important',
  border: (theme: Theme) => `1px solid ${theme.palette.vesoft.themeColor1}`,
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
