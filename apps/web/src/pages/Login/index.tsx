import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoadingButton from '@mui/lab/LoadingButton';
import { observer } from 'mobx-react-lite';
import { fetchOauth2Config } from '@studio/services';
import { useStore } from '@studio/stores';
import { FormContainer, PasswordElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { Box, Grid, CircularProgress, FormControlLabel, Switch } from '@mui/material';
import loginBgLogo from '@studio/images/login-bg-logo.svg?url';
import loginBgLogoDark from '@studio/images/login-bg-logo-dark.svg?url';
import logo from '/images/login-logo-light.svg?url';
import logoDark from '/images/login-logo-dark.svg?url';
import { brandConfig } from '@studio/utils';
import {
  LoginContainer,
  Content,
  ContentBody,
  HeaderLogo,
  ContentTitle,
  Footer,
  FooterInfo,
  FooterVersion,
  FooterCopyright,
  DelimiterBox,
  WelcomeLogin,
} from './styles';

interface LoginFormData {
  username: string;
  password: string;
  port: string;
  address: string;
}

const defaultLoginValues = (): LoginFormData => {
  const defaultHost = window.APP_CONFIG?.defaultHost?.trim();
  const defaultPort = window.APP_CONFIG?.defaultPort?.trim();
  return {
    address: defaultHost || '',
    username: '',
    password: '',
    port: defaultPort || '9669',
  };
};

function Login() {
  const navigate = useNavigate();
  const { commonStore, themeStore } = useStore();
  const [loading, setLoading] = useState(false);
  const [oauth2Enabled, setOauth2Enabled] = useState(false);
  const [isSSOMode, setIsSSOMode] = useState(false);
  const { t } = useTranslation(['login', 'common']);
  const form = useForm<LoginFormData>({ defaultValues: defaultLoginValues() });

  useEffect(() => {
    let mounted = true;
    fetchOauth2Config()
      .then((res) => {
        if (mounted) {
          setOauth2Enabled(res.code === 0 && Boolean(res.data?.enabled));
        }
      })
      .catch(() => {
        if (mounted) {
          setOauth2Enabled(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      setLoading(true);
      if (oauth2Enabled && isSSOMode) {
        const redirected = await commonStore.oauth2Login(data);
        if (!redirected) {
          setLoading(false);
        }
        return;
      }

      const flag = await commonStore.login(data);
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect') || '/';
      setTimeout(() => {
        flag && navigate(redirect);
        setLoading(false);
      }, 300);
    },
    [commonStore, isSSOMode, navigate, oauth2Enabled]
  );

  const isDarkMode = themeStore.mode === 'dark';

  return (
    <LoginContainer>
      <Box
        component="img"
        src={isDarkMode ? loginBgLogoDark : loginBgLogo}
        sx={{ width: '100%', height: '100%', position: 'absolute' }}
      />
      <Content sx={{ zIndex: 1 }}>
        <ContentTitle>
          <HeaderLogo src={isDarkMode ? logoDark : logo} loading="lazy" />
        </ContentTitle>
        <ContentBody>
          <WelcomeLogin>{t('loginTip', { ns: 'login' })}</WelcomeLogin>
          <FormContainer formContext={form} onSuccess={onSubmit}>
            <Grid container rowSpacing={2}>
              <Grid size={{ md: 6.5 }}>
                <TextFieldElement
                  sx={{ background: (theme) => theme.palette.vesoft.v2.bg1 }}
                  label={t('address', { ns: 'login' })}
                  name="address"
                  required
                  fullWidth
                  rules={{ required: 'address required' }}
                  size="medium"
                />
              </Grid>
              <Grid size={{ md: 0.5 }}>
                <DelimiterBox>:</DelimiterBox>
              </Grid>
              <Grid size={{ xs: 5 }}>
                <TextFieldElement
                  sx={{ background: (theme) => theme.palette.vesoft.v2.bg1 }}
                  name="port"
                  label={t('port', { ns: 'login' })}
                  required
                  fullWidth
                  rules={{ required: 'port required' }}
                  size="medium"
                />
              </Grid>
              {oauth2Enabled && (
                <Grid size={12}>
                  <FormControlLabel
                    control={<Switch checked={isSSOMode} onChange={(event) => setIsSSOMode(event.target.checked)} />}
                    label={t('ssoLogin', { ns: 'login' })}
                    sx={{
                      marginLeft: 0,
                      width: '100%',
                      justifyContent: 'flex-start',
                      '& .MuiFormControlLabel-label': {
                        color: (theme) => theme.palette.vesoft.v2.text1,
                        textAlign: 'left',
                      },
                    }}
                  />
                </Grid>
              )}
              {(!oauth2Enabled || !isSSOMode) && (
                <>
                  <Grid size={12}>
                    <TextFieldElement
                      sx={{ background: (theme) => theme.palette.vesoft.v2.bg1 }}
                      label={t('username', { ns: 'common' })}
                      name="username"
                      required
                      fullWidth
                      rules={{ required: 'username required' }}
                      size="medium"
                    />
                  </Grid>
                  <Grid size={12}>
                    <PasswordElement
                      sx={{ background: (theme) => theme.palette.vesoft.v2.bg1 }}
                      label={t('password', { ns: 'common' })}
                      name="password"
                      required
                      type="password"
                      fullWidth
                      rules={{ required: 'passward required' }}
                      size="medium"
                    />
                  </Grid>
                </>
              )}
              <Grid size={12}>
                <LoadingButton
                  onClick={form.handleSubmit(onSubmit)}
                  variant="contained"
                  fullWidth
                  size="large"
                  sx={{ marginTop: ({ spacing }) => spacing(2) }}
                  type="submit"
                  loadingPosition="start"
                  startIcon={loading ? <CircularProgress color="inherit" /> : undefined}
                  loading={loading}
                >
                  {t('login', { ns: 'login' })}
                </LoadingButton>
              </Grid>
            </Grid>
          </FormContainer>
          <Footer>
            <FooterInfo>
              <FooterVersion>
                {t('version', { ns: 'common' })}: {process.env.VERSION}
              </FooterVersion>
            </FooterInfo>
            <FooterCopyright>{brandConfig.copyright}</FooterCopyright>
          </Footer>
        </ContentBody>
      </Content>
    </LoginContainer>
  );
}

export default observer(Login);
