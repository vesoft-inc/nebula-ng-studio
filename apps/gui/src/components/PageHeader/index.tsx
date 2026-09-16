import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import {
  Logout,
  AccountCircleFilled,
  LinkVariantOff,
  WhiteBalanceSunny,
  MoonWaxingCrescent,
  HelpBoxMultiple,
} from '@vesoft-inc/icons';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { Web } from '@vesoft-inc/icons';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import { useStore } from '@gui/stores';
import { useStore as useStudioStore } from '@studio/stores';
import { Language } from '@gui/utils/i18n';
import { ActionContentContainer, AppBar, AppToolbar, UserInfoMenuItem } from './styles';
import { Divider, MenuItem, useTheme } from '@mui/material';
import TitleEllipsis from '@studio/components/TitleEllipsis';
import lightLogo from '/images/gui-light.svg?url';
import darkLogo from '/images/gui-dark.svg?url';
import { brandConfig } from '@studio/utils';

function PageHeader() {
  const theme = useTheme();
  const { themeStore, commonStore } = useStore();
  const { consoleStore } = useStudioStore();
  const [langAnchorEle, setLangAnchorEle] = useState<null | HTMLElement>(null);
  const [userAnchorEle, setUserAnchorEle] = useState<null | HTMLElement>(null);
  const { t } = useTranslation();
  const { userInfo, hasDarkMode } = commonStore;
  const isDarkMode = themeStore.mode === 'dark';

  const changeLang = useCallback(
    (lang: Language) => {
      commonStore.changeLanguage(lang);
      setLangAnchorEle(null);
    },
    [commonStore]
  );

  const handleClearConnect = useCallback(() => {
    setUserAnchorEle(null);
    commonStore.logout();
  }, [commonStore]);

  const toggleTheme = useCallback(() => themeStore.toggleMode(), [themeStore]);

  const getInitialData = async () => {
    await commonStore.getUserInfo();
    await consoleStore.getGraphs();
  };

  useEffect(() => {
    // Only fetch user info if we don't have it and there's a valid token
    if (!commonStore.userInfo && !commonStore.isGettingUserInfo) {
      getInitialData();
    }
  }, [commonStore]);

  return (
    <AppBar position="static">
      <AppToolbar>
        <Box component="img" loading="lazy" height={38} src={isDarkMode ? darkLogo : lightLogo} />
        <ActionContentContainer />
        <Box sx={{ flexGrow: 0 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton
              onClick={() => {
                const coreVersion = commonStore.userInfo?.coreVersion || '';
                const isValidGAVersion = /^(\d+\.\d+\.\d+)$/.test(coreVersion);
                const formattedCoreVersion = isValidGAVersion ? coreVersion : '';

                window.open(brandConfig.helpUrlTemplate.replace('{coreVersion}', formattedCoreVersion), '_blank');
              }}
            >
              <HelpBoxMultiple
                sx={{
                  color: (theme) => theme.palette.vesoft.v2.text3,
                  width: 22,
                  height: 22,
                }}
              />
            </IconButton>
            {commonStore.userInfo?.username ? (
              <>
                {hasDarkMode && (
                  <IconButton
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                <IconButton
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
              </>
            ) : (
              <Box
                onClick={() => commonStore.toggleLoginModal(true)}
                sx={{
                  color: theme.palette.vesoft.v2.error2,
                  fontWeight: theme.typography.fontWeightBold,
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  height: '100%',
                  padding: theme.spacing(0, 2),
                  cursor: 'pointer',
                }}
              >
                <LinkVariantOff />
                {t('header.notConnected', { ns: 'gui' })}
              </Box>
            )}
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
        anchorEl={commonStore.userInfo ? userAnchorEle : null}
        open={!!userAnchorEle}
        onClose={() => setUserAnchorEle(null)}
        slotProps={{
          list: {
            sx: { py: 0, minWidth: 200 },
          },
        }}
      >
        <UserInfoMenuItem sx={{ py: 1.5 }}>
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

        <Divider sx={{ marginTop: '0 !important', marginBottom: '0 !important' }} />

        <UserInfoMenuItem
          sx={{
            py: 1,
            px: 2.5,
            fontSize: 14,
            '&:hover': {
              cursor: 'pointer',
              color: theme.palette.vesoft.themeColor1,
            },
          }}
          onClick={handleClearConnect}
        >
          {t('header.clearConnect', { ns: 'gui' })} <Logout sx={{ ml: 2 }} />
        </UserInfoMenuItem>
      </Menu>
    </AppBar>
  );
}

export default observer(PageHeader);
