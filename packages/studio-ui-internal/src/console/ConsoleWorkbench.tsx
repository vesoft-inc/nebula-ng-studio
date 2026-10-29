import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTheme, Box, IconButton } from '@mui/material';
import { VectorTriangle, Fullscreen, FullscreenExit, SettingsOutlined } from '@vesoft-inc/icons';
import { useTranslation } from 'react-i18next';
import type { ConsoleResult } from './types';
import type { GraphDataTable } from '../graph/types/console';
import type { ConsoleServices } from '../shared/query';
import { Drawer } from '../shared/Drawer';
import SiderMenu from '../shared/SiderMenu';
import { SettingsContent } from '../shared/Settings/Content';
import { SettingsDrawer } from '../shared/Settings/Drawer';
import { CONSOLE_DEFAULT_LOCAL_SETTINGS, type ConsoleSettingsForm } from '../shared/Settings/constants';
import Results from './QueryResultList';
import GQLEditor from './QueryComposer';
import ConsoleController from './ConsoleController';
import { ConsoleProvider, useConsole, type ConsoleAppearance, type ConsoleProviderProps } from './context';
import { EditorWrapper, InputArea, StyledSider, SiderItem, ActionButtonsWrapper } from './styles';

const WorkbenchContext = createContext<{ onSettingsChange: (settings: ConsoleSettingsForm) => void }>({
  onSettingsChange: () => {},
});

function WorkbenchContent({
  sidebar,
  emptyState,
  settingsPending,
  canOpenSettings,
}: {
  sidebar?: ReactNode;
  emptyState?: ReactNode;
  settingsPending?: boolean;
  canOpenSettings?: () => boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation(['console']);
  const { controller: consoleStore, settings } = useConsole();
  const { onSettingsChange } = useContext(WorkbenchContext);
  const [activeMenu, setActiveMenu] = useState<string>();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [scrollDistance, setScrollDistance] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === '/' && containerRef.current?.contains(document.activeElement)) {
        const tagName = document.activeElement?.tagName;
        if (tagName !== 'TEXTAREA' && tagName !== 'INPUT') {
          e.preventDefault();
          consoleStore.editorRef?.focus();
        }
      }
    },
    [consoleStore]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

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
      tabIndex={-1}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.focus();
      }}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        height: `100%`,
        backgroundColor: theme.palette.vesoft.v2.bg2,
        overflowX: 'hidden',
      }}
    >
      {sidebar && (
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
            {activeMenu === 'Schema' && sidebar}
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
              maxHeight={editorMaxHeight}
              onRunGql={() => setIsFullscreen(false)}
              onAfterRunGql={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          </EditorWrapper>
          <ActionButtonsWrapper>
            <IconButton
              size="small"
              onClick={() => {
                if (canOpenSettings && !canOpenSettings()) return;
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

        <Results results={consoleStore.results as ConsoleResult<GraphDataTable>[]} emptyState={emptyState} />
      </Box>

      <SettingsDrawer
        open={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
        loading={settingsPending}
      >
        {!settingsPending && <SettingsContent initialData={settings} onChange={onSettingsChange} />}
      </SettingsDrawer>
    </Box>
  );
}

const ObservedWorkbench = observer(WorkbenchContent);

export interface ConsoleWorkbenchProps {
  services: ConsoleServices;
  controller?: ConsoleController;
  sidebar?: ReactNode;
  emptyState?: ReactNode;
  appearance?: ConsoleAppearance;
  settings?: ConsoleSettingsForm;
  onSettingsChange?: (settings: ConsoleSettingsForm) => void;
  settingsPending?: boolean;
  canOpenSettings?: () => boolean;
  loadGraphMetadata?: boolean;
  onExplore?: ConsoleProviderProps['onExplore'];
}

export default function ConsoleWorkbench(props: ConsoleWorkbenchProps) {
  const controller = useMemo(
    () => props.controller ?? new ConsoleController(props.services),
    [props.controller, props.services]
  );
  const [localSettings, setLocalSettings] = useState(CONSOLE_DEFAULT_LOCAL_SETTINGS);
  const settings = props.settings ?? localSettings;
  const changeSettings = useCallback(
    (values: ConsoleSettingsForm) => {
      setLocalSettings(values);
      props.onSettingsChange?.(values);
    },
    [props.onSettingsChange]
  );

  useEffect(() => {
    if (props.loadGraphMetadata !== false) void controller.getGraphs().catch(console.error);
  }, [controller, props.loadGraphMetadata]);

  useEffect(() => {
    return () => {
      if (!props.controller) controller.destroy();
    };
  }, [controller, props.controller]);

  return (
    <WorkbenchContext.Provider value={{ onSettingsChange: changeSettings }}>
      <ConsoleProvider
        controller={controller}
        settings={settings}
        appearance={props.appearance}
        onExplore={props.onExplore}
      >
        <ObservedWorkbench
          sidebar={props.sidebar}
          emptyState={props.emptyState}
          settingsPending={props.settingsPending}
          canOpenSettings={props.canOpenSettings}
        />
      </ConsoleProvider>
    </WorkbenchContext.Provider>
  );
}
