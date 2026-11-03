import { observer } from 'mobx-react-lite';
import { Box } from '@mui/material';
import { useRouter, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { StudioHeader } from '@vesoft-inc/studio-ui-internal/shell';
import { themeStore } from '@vesoft-inc/studio-ui-internal/theme';
import { commonStore } from '@studio/app/session';
import { useNavigationSection } from '@studio/app/navigation';
import { routePaths } from '@studio/app/paths';
import { Language } from '@studio/utils/i18n';
import { brandConfig } from '@studio/utils';
import darkLogo from '/images/studio-logo-dark.svg?url';
import lightLogo from '/images/studio-logo-light.svg?url';

export default observer(function PageHeader() {
  const { t } = useTranslation('common');
  const value = useNavigationSection();
  const navigate = useNavigate();
  const router = useRouter();
  const { userInfo } = commonStore;
  const items = [
    {
      key: 'schema-manager',
      label: t('schema-manager'),
      to: routePaths.schema.graphTypes,
      href: router.buildLocation({ to: routePaths.schema.graphTypes }).publicHref,
    },
    {
      key: 'console',
      label: t('console'),
      to: routePaths.console,
      href: router.buildLocation({ to: routePaths.console }).publicHref,
    },
    {
      key: 'explorer',
      label: t('explorer'),
      to: routePaths.explorer.snapshots,
      href: router.buildLocation({ to: routePaths.explorer.snapshots }).publicHref,
    },
  ];
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
      navigation={{ items, value, onNavigate: (key) => navigate({ to: items.find((item) => item.key === key)!.to }) }}
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
