import { styled } from '@mui/material/styles';
// import isPropValid from '@emotion/is-prop-valid';
import Box from '@mui/material/Box';

export const LoginContainer = styled(Box)`
  width: 100%;
  height: 100vh;
  padding-bottom: 5vh;
  min-height: 720px;
  display: flex;
  flex-direction: row-reverse;
  justify-content: center;
  align-items: center;
  background-color: ${({ theme }) => theme.palette.vesoft.v2.bg1};
  position: relative;
`;

export const Content = styled(Box)`
  width: ${({ theme }) => theme.spacing(64)};
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
`;

export const ContentBody = styled(Box)`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background-color: ${({ theme }) => theme.palette.vesoft.v2.bg3};
  padding: 40px;
  border-radius: 30px;
  border: 1px solid ${({ theme }) => theme.palette.vesoft.v2.border2};
`;

export const WelcomeLogin = styled(Box)`
  font-size: 24px;
  font-weight: 500;
  line-height: 54px;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  color: ${({ theme }) => theme.palette.vesoft.textColor1};
`;

export const HeaderLogo = styled('img')`
  height: 54px;
`;

export const ContentTitle = styled(Box)`
  color: ${({ theme }) => theme.palette.vesoft.v2.text1};
  font-weight: 700;
  text-align: center;
  font-size: 24px;
  margin-bottom: ${({ theme }) => theme.spacing(5)};
  display: flex;
  align-items: center;
`;

export const Footer = styled(Box)`
  flex: 1;
  flex-direction: column;
  margin-top: 50px;
  display: flex;
  justify-content: flex-end;
`;

export const FooterInfo = styled(Box)`
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 700;
`;

export const FooterVersion = styled('span')`
  font-size: 14px;
  color: ${({ theme }) => theme.palette.text.primary};
`;

// use `isPropValid` to avoid emotion warning while passing props to Emotion styled component
// https://emotion.sh/docs/styled#customizing-prop-forwarding
export const FooterCopyright = styled(Box)`
  margin-top: 15px;
  font-size: 12px;
  line-height: 16px;
  text-align: center;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

export const DelimiterBox = styled('span')`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14px;
  font-weight: 700;
`;
