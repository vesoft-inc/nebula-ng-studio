import { observer } from 'mobx-react-lite';
import { Box } from '@mui/material';
import { useHref, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StudioHeader } from '@vesoft-inc/ui-components/shell';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { commonStore } from '@studio/stores/session';
import { Language } from '@studio/utils/i18n';
import { brandConfig } from '@studio/utils';
import darkLogo from '/images/studio-logo-dark.svg?url';
import lightLogo from '/images/studio-logo-light.svg?url';

export default observer(function PageHeader() {
  const { t } = useTranslation('common');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { userInfo } = commonStore;
  const items = [
    {
      key: 'schema-manager',
      label: t('schema-manager'),
      to: '/schema-manager/graphtype',
      href: useHref('/schema-manager/graphtype'),
    },
    { key: 'console', label: t('console'), to: '/console', href: useHref('/console') },
    { key: 'explorer', label: t('explorer'), to: '/explorer/snapshots', href: useHref('/explorer/snapshots') },
  ];
  const value = pathname.startsWith('/schema')
    ? 'schema-manager'
    : pathname.startsWith('/explorer')
      ? 'explorer'
      : 'console';
  return (
    <StudioHeader
      logo={
        <Box
          component="img"
          alt="Studio"
          loading="lazy"
          height={38}
          src={themeStore.mode === 'dark' ? darkLogo : lightLogo}
        />
      }
      navigation={{ items, value, onNavigate: (key) => navigate(items.find((item) => item.key === key)!.to) }}
      user={userInfo}
      onLanguageChange={(locale) => commonStore.changeLanguage(locale as Language)}
      onToggleTheme={commonStore.hasDarkMode ? themeStore.toggleMode : undefined}
      onDisconnect={commonStore.logout}
      versions={[
        {
          label: 'Studio',
          value: `v${userInfo?.version === 'Unknown' ? process.env.VERSION : userInfo?.version || ''}`,
        },
        { label: brandConfig.consoleName, value: `v${userInfo?.coreVersion?.split(',')?.[0] || ''}` },
      ]}
    />
  );
});
