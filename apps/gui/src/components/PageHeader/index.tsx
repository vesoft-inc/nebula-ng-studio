import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, IconButton } from '@mui/material';
import { HelpBoxMultiple, LinkVariantOff } from '@vesoft-inc/icons';
import { useTranslation } from 'react-i18next';
import { StudioHeader } from '@vesoft-inc/ui-components/shell';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { commonStore } from '@gui/stores/session';
import { consoleStore } from '@gui/stores/console';
import { Language } from '@gui/utils/i18n';
import { brandConfig } from '@gui/utils/brand';
import lightLogo from '/images/gui-light.svg?url';
import darkLogo from '/images/gui-dark.svg?url';

export default observer(function PageHeader() {
  const { t } = useTranslation('gui');
  useEffect(() => {
    if (!commonStore.userInfo && !commonStore.isGettingUserInfo)
      void commonStore.getUserInfo().then(() => consoleStore.getGraphs());
  }, []);
  return (
    <StudioHeader
      height={56}
      compact
      actionOrder="theme-language"
      logo={
        <Box
          component="img"
          alt="GUI"
          loading="lazy"
          height={38}
          src={themeStore.mode === 'dark' ? darkLogo : lightLogo}
        />
      }
      user={commonStore.userInfo}
      onLanguageChange={(locale) => commonStore.changeLanguage(locale as Language)}
      onToggleTheme={commonStore.hasDarkMode ? themeStore.toggleMode : undefined}
      onDisconnect={commonStore.logout}
      disconnectLabel={t('header.clearConnect')}
      actions={
        <IconButton
          aria-label="Help"
          onClick={() => {
            const version = commonStore.userInfo?.coreVersion || '';
            window.open(
              brandConfig.helpUrlTemplate.replace('{coreVersion}', /^(\d+\.\d+\.\d+)$/.test(version) ? version : ''),
              '_blank'
            );
          }}
        >
          <HelpBoxMultiple sx={{ color: (theme) => theme.palette.vesoft.v2.text3, width: 22, height: 22 }} />
        </IconButton>
      }
      connectionAction={
        !commonStore.userInfo?.username ? (
          <Box
            onClick={() => commonStore.toggleLoginModal(true)}
            sx={{
              color: (theme) => theme.palette.vesoft.v2.error2,
              fontWeight: 'bold',
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              height: '100%',
              px: 2,
              cursor: 'pointer',
            }}
          >
            <LinkVariantOff />
            {t('header.notConnected')}
          </Box>
        ) : undefined
      }
    />
  );
});
