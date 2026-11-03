import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Box } from '@mui/material';
import { LoginPage } from '@vesoft-inc/studio-ui-internal/shell';
import { themeStore } from '@vesoft-inc/studio-ui-internal/theme';
import { commonStore } from '@studio/app/session';
import { fetchOauth2Config } from '@studio/services';
import { brandConfig } from '@studio/utils';
import { loginReturnPath, toBrowserPath } from '@studio/app/paths';
import loginBgLogo from '@studio/images/login-bg-logo.svg?url';
import loginBgLogoDark from '@studio/images/login-bg-logo-dark.svg?url';
import logo from '/images/login-logo-light.svg?url';
import logoDark from '/images/login-logo-dark.svg?url';

export default observer(function Login() {
  const [oauthEnabled, setOauthEnabled] = useState(false);
  const navigate = useNavigate();
  const { searchStr } = useLocation();
  useEffect(() => {
    let active = true;
    void fetchOauth2Config()
      .then((res) => {
        if (active) setOauthEnabled(res.code === 0 && !!res.data?.enabled);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const dark = themeStore.mode === 'dark';
  return (
    <LoginPage
      oauthEnabled={oauthEnabled}
      logo={<Box component="img" alt="Studio" src={dark ? logoDark : logo} loading="lazy" height={54} />}
      background={dark ? loginBgLogoDark : loginBgLogo}
      version={process.env.VERSION}
      copyright={brandConfig.copyright}
      defaultValues={{
        address: window.APP_CONFIG?.defaultHost?.trim() || '',
        port: window.APP_CONFIG?.defaultPort?.trim() || '9669',
      }}
      onSubmit={async (data, { sso }) => {
        if (sso) {
          await commonStore.oauth2Login(data);
          return;
        }
        const success = await commonStore.login(data);
        if (success)
          navigate({
            href: toBrowserPath(loginReturnPath(searchStr, window.APP_CONFIG?.basePath), window.APP_CONFIG?.basePath),
            replace: true,
          });
      }}
    />
  );
});
