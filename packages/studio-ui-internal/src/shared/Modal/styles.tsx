import { StyledComponent } from '@emotion/styled';
import { Dialog, type DialogProps, type DialogContentProps, DialogContent } from '@mui/material';
import { styled } from '@mui/material/styles';

export const BootstrapDialog: StyledComponent<DialogProps> = styled(Dialog)<DialogProps>`
  & .MuiPaper-root {
    max-width: 1000px;
    // background: ${({ theme }) => theme.palette.vesoft.v2.bg1};
  }
  & .MuiDialogContent-root {
    min-width: 360px;
    overflow-y: unset;
    padding: ${({ theme }) => `0 ${theme.spacing(3)}`};
  }
  & .MuiDialogActions-root {
    padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
    height: 64px;
  }
  & .MuiDialogTitle-root {
    min-height: 56px;
    font-weight: bold;
    padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
  }
`;

export const ModalContent: StyledComponent<DialogContentProps> = styled(DialogContent)<DialogContentProps>`
  width: 600px;
  padding: ${({ theme }) => theme.spacing(3)};
`;
