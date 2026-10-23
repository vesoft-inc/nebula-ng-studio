import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { ConnectionForm, type ConnectionFormProps } from './ConnectionForm';
import {
  Content,
  ContentBody,
  ContentTitle,
  Footer,
  FooterCopyright,
  FooterInfo,
  FooterVersion,
  LoginContainer,
  WelcomeLogin,
} from './loginStyles';

export interface LoginPageProps extends ConnectionFormProps {
  logo?: ReactNode;
  background?: string;
  version?: string;
  copyright?: ReactNode;
  title?: ReactNode;
}
export function LoginPage({ logo, background, version, copyright, title, ...form }: LoginPageProps) {
  const { t } = useTranslation(['login', 'common']);
  return (
    <LoginContainer>
      {background && (
        <Box component="img" alt="" src={background} sx={{ width: '100%', height: '100%', position: 'absolute' }} />
      )}
      <Content sx={{ zIndex: 1 }}>
        <ContentTitle>{logo}</ContentTitle>
        <ContentBody>
          <WelcomeLogin>{title ?? t('loginTip', { ns: 'login' })}</WelcomeLogin>
          <ConnectionForm {...form} />
          <Footer>
            <FooterInfo>
              {version && (
                <FooterVersion>
                  {t('version', { ns: 'common' })}: {version}
                </FooterVersion>
              )}
            </FooterInfo>
            <FooterCopyright>{copyright}</FooterCopyright>
          </Footer>
        </ContentBody>
      </Content>
    </LoginContainer>
  );
}
