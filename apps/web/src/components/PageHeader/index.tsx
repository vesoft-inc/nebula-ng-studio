import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { Logout, AccountCircleFilled } from '@vesoft-inc/icons';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { Web, WhiteBalanceSunny, MoonWaxingCrescent } from '@vesoft-inc/icons';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { commonStore, schemaStore } from '@studio/stores/session';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { Language } from '@studio/utils/i18n';
import {
  AbsoluteLink,
  ActionContentContainer,
  AppBar,
  AppToolbar,
  MenuTab,
  MenuTabs,
  UserInfoMenuItem,
} from './styles';
import { Typography, useTheme } from '@mui/material';
import TitleEllipsis from '@studio/components/TitleEllipsis';
import darkLogo from '/images/studio-logo-dark.svg?url';
import lightLogo from '/images/studio-logo-light.svg?url';
import { brandConfig } from '@studio/utils';

export default observer(function PageHeader() {
  const [langAnchorEle, setLangAnchorEle] = useState<null | HTMLElement>(null);
  const [userAnchorEle, setUserAnchorEle] = useState<null | HTMLElement>(null);
  const { t } = useTranslation(['common']);
  const toggleTheme = useCallback(() => themeStore.toggleMode(), [themeStore]);
  const changeLang = useCallback(
    (lang: Language) => {
      commonStore.changeLanguage(lang);
      setLangAnchorEle(null);
    },
    [commonStore]
  );
  const { userInfo, hasDarkMode } = commonStore;
  const currentRoute = useLocation().pathname.split('/')[1];
  const isDarkMode = themeStore.mode === 'dark';
  const theme = useTheme();

  const PageRoutes = useMemo(
    () => [
      {
        key: 'schema-manager',
        label: t('schema-manager', { ns: 'common' }),
        to: `/schema-manager/graphtype`,
      },
      {
        key: 'console',
        label: t('console', { ns: 'common' }),
        to: '/console',
      },
      {
        key: 'explorer',
        label: t('explorer', { ns: 'common' }),
        to: '/explorer/snapshots',
      },
    ],
    [t, schemaStore.schemas.length]
  );

  const getVersion = () => {
    if (userInfo?.version === 'Unknown') {
      return process.env.VERSION;
    }
    return userInfo?.version || '';
  };

  const getCurrentMenu = () => {
    if (['schema-manager', 'schema-list'].includes(currentRoute)) {
      return 'schema-manager';
    }
    if (currentRoute === 'explorer') {
      return 'explorer';
    }
    return 'console';
  };

  return (
    <AppBar position="static">
      <AppToolbar>
        <Box component="img" loading="lazy" height={38} src={isDarkMode ? darkLogo : lightLogo} />
        <ActionContentContainer>
          <MenuTabs
            value={getCurrentMenu()}
            TabIndicatorProps={{
              sx: { backgroundColor: themeStore.palette.vesoft?.themeColor1 },
            }}
          >
            {PageRoutes.map((route) => (
              <MenuTab
                key={route.key}
                value={route.key}
                label={
                  <Typography component="span">
                    {route.label}
                    <AbsoluteLink to={route.to} />
                  </Typography>
                }
              />
            ))}
          </MenuTabs>
        </ActionContentContainer>
        <Box sx={{ flexGrow: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ '& > .MuiIconButton-root': { p: 0.75, minWidth: 36, minHeight: 36 } }}
          >
            <IconButton
              sx={{
                color: theme.palette.vesoft.textColor3,
              }}
              aria-haspopup="menu"
              onClick={(e) => setLangAnchorEle(e.currentTarget)}
            >
              <Web
                sx={{
                  fill: theme.palette.vesoft.v2.text3,
                  width: 24,
                  height: 24,
                }}
              />
            </IconButton>
            {hasDarkMode && (
              <IconButton
                sx={{
                  color: theme.palette.vesoft.textColor3,
                }}
                onClick={toggleTheme}
              >
                {isDarkMode ? (
                  <WhiteBalanceSunny
                    sx={{
                      fill: theme.palette.vesoft.v2.text3,
                      width: 22,
                      height: 22,
                    }}
                  />
                ) : (
                  <MoonWaxingCrescent
                    sx={{
                      fill: theme.palette.vesoft.v2.text3,
                      width: 22,
                      height: 22,
                    }}
                  />
                )}
              </IconButton>
            )}
            <IconButton
              sx={{
                color: theme.palette.vesoft.v2.primary3,
              }}
              onClick={(e) => setUserAnchorEle(e.currentTarget)}
            >
              <AccountCircleFilled
                fontSize="large"
                color="primary"
                sx={{
                  width: 27,
                  height: 27,
                }}
              />
            </IconButton>
          </Stack>
        </Box>
      </AppToolbar>
      <Menu
        anchorEl={langAnchorEle}
        open={!!langAnchorEle}
        onClose={() => setLangAnchorEle(null)}
        MenuListProps={{ 'aria-labelledby': 'basic-button' }}
      >
        <MenuItem onClick={() => changeLang(Language.EN_US)}>English</MenuItem>
        <MenuItem onClick={() => changeLang(Language.ZH_CN)}>中文</MenuItem>
      </Menu>
      <Menu
        anchorEl={userAnchorEle}
        open={!!userAnchorEle}
        onClose={() => setUserAnchorEle(null)}
        MenuListProps={{ 'aria-labelledby': 'basic-button', sx: { padding: 2, pb: 1 } }}
      >
        <UserInfoMenuItem>
          <Box display="flex" alignItems="center">
            <AccountCircleFilled fontSize="large" color="primary" />
            <Box ml={1} fontSize={12}>
              <Box fontWeight="bold">{userInfo?.username}</Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                Graphd:
                <TitleEllipsis
                  title={userInfo?.address}
                  maxWidth={200}
                  slotProps={{
                    fontSize: 12,
                    fontWeight: 400,
                  }}
                />
              </Box>
            </Box>
          </Box>
        </UserInfoMenuItem>
        <Box my={0.5} height={1} width="100%" sx={{ borderBottom: `1px solid ${theme.palette.vesoft.textColor6}` }} />

        <UserInfoMenuItem>
          <Box fontSize={14} lineHeight={2}>
            <Box display="flex" alignItems="center">
              Sudio:{' '}
              <Box ml={1} fontWeight="bold">
                v{getVersion()}
              </Box>
            </Box>
            <Box display="flex" alignItems="center">
              {brandConfig.consoleName}:{' '}
              <Box ml={1} fontWeight="bold">
                v{userInfo?.coreVersion?.split(',')?.[0] || ''}
              </Box>
            </Box>
          </Box>
        </UserInfoMenuItem>
        <Box my={0.5} height={1} width="100%" sx={{ borderBottom: `1px solid ${theme.palette.vesoft.textColor6}` }} />

        <UserInfoMenuItem
          sx={{
            height: 32,
            fontSize: 14,
            '&:hover': {
              cursor: 'pointer',
              color: theme.palette.vesoft.themeColor1,
            },
          }}
          onClick={commonStore.logout}
        >
          {t('clearConnect', { ns: 'common' })} <Logout sx={{ ml: 2 }} />
        </UserInfoMenuItem>
      </Menu>
    </AppBar>
  );
});
