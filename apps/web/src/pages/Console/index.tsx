import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { VectorTriangle, Fullscreen, FullscreenExit, SettingsOutlined } from '@vesoft-inc/icons';

import { commonStore, consoleStore } from '@studio/stores/session';
import Results from './Results';
import GQLEditor from './GQLEditor';
import { EditorWrapper, InputArea, StyledSider, SiderItem, ActionButtonsWrapper } from './styles';
import SiderMenu from '@studio/components/SiderMenu';
import SchemaTree from '@studio/components/SchemaTree';
import { isGuiTarget } from '@studio/utils';
import { useTranslation } from 'react-i18next';
import type { ConsoleResult } from '@vesoft-inc/utils';
import type { GraphDataTable } from '@studio/interfaces/explorer';
import { Drawer } from '@vesoft-inc/ui-components';
import { SettingsContent, SettingsDrawer } from '@studio/components/Settings';
import { getToken } from '@gui/utils/auth';
import { useStorageSettings } from '@studio/components/Settings/hook';
import {
  CONSOLE_DEFAULT_LOCAL_SETTINGS,
  StudioSettingIdPrefix,
  GuiSettingIdPrefix,
  type ConsoleSettingsForm,
} from '@studio/components/Settings/constants';

function Console() {
  const theme = useTheme();
  const { t } = useTranslation(['console']);
  const [activeMenu, setActiveMenu] = useState<string>();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [scrollDistance, setScrollDistance] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const settingId = isGuiTarget
    ? `${GuiSettingIdPrefix}`
    : `${StudioSettingIdPrefix}${commonStore.userInfo?.username ?? ''}`;
  const { settings, upsertSettings, isPending } = useStorageSettings<ConsoleSettingsForm>({
    settingId,
    defaultSettings: CONSOLE_DEFAULT_LOCAL_SETTINGS,
    storageInstance: sessionStorage,
  });

  const siderItems = useMemo(
    () => [
      {
        key: 'Schema',
        label: 'Schema',
        icon: <VectorTriangle fontSize="medium" />,
        sx: { height: 48 },
      },
    ],
    []
  );

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === '/') {
      const tagName = document.activeElement?.tagName;
      if (tagName !== 'TEXTAREA' && tagName !== 'INPUT') {
        e.preventDefault();
        consoleStore.editorRef?.focus();
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const fn = (e: Event) => {
      const target = e.target as HTMLElement;
      setScrollDistance(target.scrollTop);
    };
    container.addEventListener('scroll', fn);
    return () => container.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (consoleStore.editorRef) {
      consoleStore.editorRef.focus();
    }
  }, [consoleStore.editorRef]);

  // Dynamic editor max height based on containerRef height
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const editorMaxHeight = useMemo(() => {
    if (isFullscreen && containerHeight) {
      // 64px: header or reserved space
      return `${containerHeight - 32}px`;
    }
    return '400px';
  }, [isFullscreen, containerHeight]);
  useEffect(() => {
    const updateContainerHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };
    updateContainerHeight();
    window.addEventListener('resize', updateContainerHeight);
    return () => window.removeEventListener('resize', updateContainerHeight);
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        height: `100%`,
        backgroundColor: theme.palette.vesoft.v2.bg2,
        overflowX: 'hidden',
      }}
    >
      {!isGuiTarget && (
        <StyledSider>
          <SiderItem sx={{ width: theme.spacing(6) }}>
            <SiderMenu
              wrapSx={{ paddingTop: 0 }}
              items={siderItems}
              onMenuClick={(key) => {
                setActiveMenu(key === activeMenu ? undefined : key);
                setDrawerOpen(!drawerOpen);
              }}
              activeKey={activeMenu}
            />
          </SiderItem>
          <Drawer
            open={drawerOpen}
            variant="permanent"
            openWidth={302}
            sx={{
              height: '100%',
              '& .MuiDrawer-paper': {
                width: drawerOpen ? 302 : 0,
                transition: 'width 0.3s',
                height: '100%',
                padding: 0,
                borderRight: 0,
              },
            }}
          >
            {activeMenu === 'Schema' && <SchemaTree />}
          </Drawer>
        </StyledSider>
      )}
      <Box
        ref={scrollContainerRef}
        sx={{
          position: 'relative',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: '24px',
          ...(isFullscreen && {
            position: 'fixed',
            inset: 0,
            zIndex: theme.zIndex.modal + 1,
            backgroundColor: theme.palette.vesoft.v2.bg2,
          }),
        }}
      >
        <InputArea
          sx={{
            zIndex: theme.zIndex.drawer + 1,
            boxShadow: scrollDistance > 0 ? '0px 2px 8px 0px rgba(0, 0, 0, 0.12)' : 'none',
            transition: 'box-shadow 0.3s',
            ...(isFullscreen
              ? {
                  position: 'fixed',
                  height: '100%',
                  inset: 0,
                }
              : {
                  position: 'sticky',
                  top: 0,
                  marginBottom: '12px',
                }),
          }}
        >
          <EditorWrapper
            sx={{
              backgroundColor: (theme) => theme.palette.vesoft.v2.bg2,
              ...(isFullscreen && {
                maxHeight: 'unset',
              }),
            }}
          >
            <GQLEditor
              settings={settings}
              maxHeight={editorMaxHeight}
              onRunGql={() => setIsFullscreen(false)}
              onAfterRunGql={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          </EditorWrapper>
          <ActionButtonsWrapper>
            <IconButton
              size="small"
              onClick={() => {
                if (isGuiTarget) {
                  // Must be authed on open settings
                  const token = getToken();
                  if (token) {
                    setIsSettingsDrawerOpen(true);
                  }
                  return;
                }

                setIsSettingsDrawerOpen(true);
              }}
              title={t('settings')}
              disabled={isFullscreen}
              sx={{
                color: theme.palette.vesoft.v2.text3,
                '&:hover': {
                  color: theme.palette.vesoft.v2.text1,
                  backgroundColor: theme.palette.vesoft.v2.bg3,
                },
              }}
            >
              <SettingsOutlined />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
              sx={{
                color: theme.palette.vesoft.v2.text3,
                '&:hover': {
                  color: theme.palette.vesoft.v2.text1,
                  backgroundColor: theme.palette.vesoft.v2.bg3,
                },
              }}
            >
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </ActionButtonsWrapper>
        </InputArea>

        <Results results={consoleStore.results as ConsoleResult<GraphDataTable>[]} />
      </Box>

      <SettingsDrawer open={isSettingsDrawerOpen} onClose={() => setIsSettingsDrawerOpen(false)} loading={isPending}>
        {!isPending && <SettingsContent initialData={settings} onChange={upsertSettings} />}
      </SettingsDrawer>
    </Box>
  );
}

export default observer(Console);
