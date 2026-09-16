import { useState, useCallback, FunctionComponent, lazy, Suspense, useMemo, useEffect } from 'react';
import {
  CloseFilled,
  Table,
  CodeBracesBox,
  Sitemap,
  ErrorOutline,
  ExplorerDataOutline,
  Fullscreen,
  FullscreenExit,
  TrayArrowDown,
  ExpandMoreFilled,
  SearchFilled,
  CloseFilled as CloseSmall,
  MonitorDashboard,
} from '@vesoft-inc/icons';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import { ConsoleResult } from '@vesoft-inc/utils';
import { Dropdown } from '@vesoft-inc/ui-components';
import { observer } from 'mobx-react-lite';
import {
  OutputContainer,
  OutputHeader,
  HeaderTitle,
  HeaderAction,
  OutputContent,
  ContentMain,
  StyledIconButton,
  OutputFooter,
  fullScreenCls,
} from './styles';
import { GraphDataTable } from '@studio/interfaces/console';
import { Trans, useTranslation } from 'react-i18next';
import { brandConfig, JSONBig, formatMicroseconds, transformNebulaResult } from '@studio/utils';
import { EmptyResultId } from '@studio/utils/constant';
import { Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { useStore } from '@studio/stores';
import { hasExplainInfo, isGraphResult } from '@studio/utils/explorer';
import { HorizonTabs, type HorizonTabItem } from '../HorizonTabs';
import { generateFullGraphCanvas } from '@studio/utils/graph/base/screenshot';
import IconButton from '@mui/material/IconButton';
import { useResizable } from '@studio/hooks/useResizable';
import { WarningCount } from './WarningCount';

enum OutputMenu {
  Table = 'table',
  Raw = 'raw',
  ExplorerData = 'graph',
  Stethoscope = 'stethoscope',
  Plan = 'plan',
  Stats = 'stats',
  Error = 'error',
}

const MenuResultMap: Record<
  OutputMenu,
  FunctionComponent<{ result: ConsoleResult<GraphDataTable>; searchValue?: string }>
> = {
  [OutputMenu.Table]: lazy(() => import('./TableResult')),
  [OutputMenu.Raw]: lazy(() => import('./RawResult')),
  [OutputMenu.ExplorerData]: lazy(() => import('./GraphResult')),
  [OutputMenu.Stethoscope]: () => null,
  [OutputMenu.Plan]: lazy(() => import('./PlanResult')),
  [OutputMenu.Stats]: lazy(() => import('./StatsResult')),
  [OutputMenu.Error]: lazy(() => import('./ErrorResult')),
};

const Spinning = () => (
  <Box sx={{ p: 2, width: '100%', height: '100%' }}>
    <Skeleton animation="wave" height="20%" />
    <Skeleton animation="wave" height="20%" />
    <Skeleton animation="wave" height="20%" />
    <Skeleton animation="wave" height="20%" />
    <Skeleton animation="wave" height="20%" />
  </Box>
);

const ResultComponent = ({
  activeMenu,
  result,
  searchValue,
}: {
  activeMenu?: OutputMenu;
  result: ConsoleResult<GraphDataTable>;
  searchValue?: string;
}) => {
  if (!activeMenu) return null;
  const ResultComp = MenuResultMap[activeMenu] || (() => null);
  if (activeMenu === OutputMenu.Table) {
    return <ResultComp result={result} searchValue={searchValue} />;
  }
  return <ResultComp result={result} />;
};

function OutputBox({ result }: { result: ConsoleResult<GraphDataTable> }) {
  const theme = useTheme();
  const [activeMenu, setActiveMenu] = useState<OutputMenu>();
  // const { planDesc } = result.data || {};
  const handleMenuClick = useCallback((key: string) => {
    setActiveMenu(key as OutputMenu);
  }, []);
  const { consoleStore } = useStore();

  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Resizable functionality
  const { height, isResizing, handleMouseDown } = useResizable({
    initialHeight: 456,
    minHeight: 1,
    maxHeight: 800,
  });

  useEffect(() => {
    // Make sure the graph resize event is triggered.
    window.dispatchEvent(new Event('resize'));
  }, [isFullScreen, height]);

  useEffect(() => {
    // Prevent text selection during resize
    if (isResizing) {
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>('');

  const { t } = useTranslation(['console']);

  const finMenuItems = useMemo<HorizonTabItem[]>(() => {
    // const planMenuItem: SiderMenuItem = {
    //   key: OutputMenu.Plan,
    //   label: OutputMenu.Plan,
    //   icon: <Sitemap fontSize="medium" />,
    //   sx: { height: 50 },
    // };

    const errorSiderMenuItems: HorizonTabItem[] = [
      {
        key: OutputMenu.Error,
        label: t(OutputMenu.Error, { ns: 'console' }),
        icon: <ErrorOutline fontSize="medium" />,
        sx: { height: 50 },
      },
    ];

    const siderMenuItems: HorizonTabItem[] = [
      // {
      //   key: OutputMenu.Stethoscope,
      //   label: OutputMenu.Stethoscope,
      //   icon: <Stethoscope fontSize="medium" />,
      //   sx: { height: 50 },
      //   disabled: true,
      // },
      // ...(planDesc ? [planMenuItem] : []),
    ];

    if (result.code !== 0) return errorSiderMenuItems;

    if (result.id === EmptyResultId) return siderMenuItems;

    const tableData = result.data?.tables || [];

    if (tableData.length > 0) {
      siderMenuItems.unshift(
        {
          key: OutputMenu.Table,
          label: t(OutputMenu.Table, { ns: 'console' }),
          icon: <Table />,
          sx: { height: 40 },
        },
        {
          key: OutputMenu.Raw,
          label: t(OutputMenu.Raw, { ns: 'console' }),
          icon: <CodeBracesBox />,
          sx: { height: 40 },
        }
      );
    }

    const items: HorizonTabItem[] = [];

    if (result.data?.summary?.explainType !== 'explain') {
      items.push(...siderMenuItems);
    }

    if (isGraphResult(tableData)) {
      items.unshift({
        key: OutputMenu.ExplorerData,
        label: t(OutputMenu.ExplorerData, { ns: 'console' }),
        icon: <ExplorerDataOutline />,
        sx: { height: 40 },
      });
    }

    if (result.data && hasExplainInfo(result.data)) {
      items.push({
        key: OutputMenu.Plan,
        label: t(OutputMenu.Plan, { ns: 'console' }),
        icon: <Sitemap />,
        sx: { height: 40 },
      });
    }

    // Add Stats tab if queryStats exists and has content
    const stats = (result.queryStats || []).map((item) => item.trim()).filter(Boolean);
    if (stats.length > 0) {
      items.push({
        key: OutputMenu.Stats,
        label: t(OutputMenu.Stats, { ns: 'console' }),
        icon: <MonitorDashboard />,
        sx: { height: 40 },
      });
    }

    return items;
  }, [result, t]);

  useEffect(() => {
    setActiveMenu(finMenuItems[0]?.key as OutputMenu);
  }, [finMenuItems.length]);

  const handleFullScreen = () => {
    setIsFullScreen(true);
  };

  const handleExitFullScreen = () => {
    setIsFullScreen(false);
  };

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleExpotCsv = () => {
    if (!result.data) {
      return;
    }
    let url = '#';
    const { headers = [], tables = [] } = result.data;
    const data = tables
      .map((item) => {
        const obj = (headers || []).reduce(
          (acc, key) => {
            acc[key] = JSONBig.stringify(transformNebulaResult(item[key]));
            return acc;
          },
          {} as Record<string, string>
        );
        return obj;
      })
      .map((item) => headers.map((header) => item[header]))
      .map((row) =>
        // HACK: waiting for use case if there need to check int or string
        row.map((value) => `"${value.toString().replace(/"/g, '""')}"`).join(',')
      );
    const csv = [headers, ...data].join('\n');
    const _utf = '\uFEFF';
    if (window.Blob && window.URL) {
      const csvBlob = new Blob([_utf + csv], {
        type: 'text/csv',
      });
      url = URL.createObjectURL(csvBlob);
    }
    url = 'data:attachment/csv;charset=utf-8,' + _utf + encodeURIComponent(csv);
    const link = document.createElement('a');
    link.href = url;
    link.download = `result.csv`;
    link.click();
  };

  const handleExportJson = () => {
    if (!result.data) {
      return;
    }
    const json = JSONBig.stringify(result.data);
    const _utf = '\uFEFF';
    if (window.Blob && window.URL) {
      const jsonBlob = new Blob([_utf + json], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(jsonBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `result.json`;
      link.click();
    }
  };

  const handleExportPngFullCanvas = () => {
    const { graphWorkspaces } = consoleStore;
    const explorerItem = graphWorkspaces.get(result.id);
    const graph = explorerItem?.graph;
    if (!graph) return;
    graph.setPageLoading(true);
    try {
      generateFullGraphCanvas({
        graph,
        theme,
        callback: (canvas) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                graph.setPageLoading(false);
                return;
              }

              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              const filename = (explorerItem.currentSnapshot?.name || 'graph') + '.png';
              a.href = url;
              a.download = filename;
              a.click();
              window.URL.revokeObjectURL(url);

              graph.setPageLoading(false);
            },
            'image/png',
            0.95
          ); // High quality PNG
        },
      });
    } catch (error) {
      console.error('PNG full canvas export error:', error);
      graph.setPageLoading(false);
    }
  };

  return (
    <OutputContainer
      className={isFullScreen ? fullScreenCls : undefined}
      sx={{ flex: 1, zIndex: isFullScreen ? theme.zIndex.drawer + 1 : undefined }}
    >
      <OutputHeader>
        <HeaderTitle success={!result.code}>
          <Typography fontSize={12} fontWeight={400} color={theme.palette.vesoft.v2.text3} mr={1} noWrap flexShrink={0}>
            {`[${brandConfig.consolePrompt}]>`}
          </Typography>
          <Box
            component="span"
            overflow="hidden"
            onClick={() => {
              consoleStore.updateEditorValue(result.gql);
            }}
            sx={{
              WebkitBoxOrient: 'vertical',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'Menlo, Monaco',
              fontSize: '12px',
              '&:hover': {
                textDecoration: 'underline',
                cursor: 'pointer',
                color: theme.palette.vesoft.v2.text2,
              },
            }}
          >
            {result.gql}
          </Box>
        </HeaderTitle>
        <HeaderAction sx={{ flex: '0 0 30px', width: 'auto', gap: '8px', px: 1.5 }}>
          <StyledIconButton onClick={handleToggleCollapse} disabled={isFullScreen}>
            <Box
              sx={{
                transform: isCollapsed ? 'rotate(0deg) translateY(2px)' : 'rotate(180deg) translateY(2px)',
                transformOrigin: '50% 50%',
                transition: 'transform 0.3s ease-in-out',
              }}
            >
              <ExpandMoreFilled sx={{ width: 20, height: 20 }} />
            </Box>
          </StyledIconButton>
          {isFullScreen ? (
            <StyledIconButton onClick={handleExitFullScreen}>
              <FullscreenExit sx={{ width: 20, height: 20 }} />
            </StyledIconButton>
          ) : (
            <StyledIconButton onClick={handleFullScreen}>
              <Fullscreen sx={{ width: 20, height: 20 }} />
            </StyledIconButton>
          )}
          <StyledIconButton onClick={result.destroy} disabled={isFullScreen}>
            <CloseFilled sx={{ width: 20, height: 20 }} />
          </StyledIconButton>
        </HeaderAction>
      </OutputHeader>
      <Collapse in={!isCollapsed || isFullScreen} timeout={300}>
        <OutputContent
          style={{
            height: isFullScreen ? 'calc(100vh - 42px)' : 'auto',
          }}
        >
          <ContentMain>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              {finMenuItems.length > 0 && result.code === 0 && (
                <>
                  {/* Hide tabs on error */}
                  <HorizonTabs
                    items={finMenuItems as Parameters<typeof HorizonTabs>[0]['items']}
                    onMenuClick={handleMenuClick}
                    value={activeMenu || finMenuItems[0]?.key || ''}
                  />
                  {/* Search */}
                  <Stack direction="row" alignItems="center" gap="8px" sx={{ px: 1.5 }}>
                    {activeMenu === OutputMenu.Table && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'width 0.3s ease-in-out',
                          width: searchOpen ? '200px' : '24px',
                          overflow: 'hidden',
                        }}
                      >
                        {searchOpen ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              position: 'relative',
                              width: '100%',
                            }}
                          >
                            <Box
                              component="input"
                              value={searchValue}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchValue(e.target.value)}
                              onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === 'Escape') {
                                  setSearchValue('');
                                  setSearchOpen(false);
                                }
                              }}
                              onBlur={() => {
                                if (!searchValue.trim()) {
                                  setSearchOpen(false);
                                }
                              }}
                              autoFocus
                              sx={{
                                width: '100%',
                                height: '24px',
                                border: `1px solid ${theme.palette.vesoft.v2.border1}`,
                                borderRadius: '4px',
                                px: 1,
                                pr: searchValue ? '28px' : '8px',
                                fontSize: '12px',
                                backgroundColor: theme.palette.vesoft.v2.bg1,
                                color: theme.palette.vesoft.v2.text1,
                                outline: 'none',
                                '&:focus': {
                                  borderColor: theme.palette.vesoft.v2.primary3,
                                },
                                '&::placeholder': {
                                  color: theme.palette.vesoft.v2.text3,
                                },
                              }}
                            />
                            {searchValue && (
                              <IconButton
                                onClick={() => {
                                  setSearchValue('');
                                  setSearchOpen(false);
                                }}
                                sx={{
                                  position: 'absolute',
                                  right: '2px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  width: 20,
                                  height: 20,
                                  backgroundColor: 'transparent',
                                  '&:hover': {
                                    backgroundColor: theme.palette.vesoft.v2.bg3,
                                  },
                                }}
                              >
                                <CloseSmall sx={{ width: 12, height: 12 }} />
                              </IconButton>
                            )}
                          </Box>
                        ) : (
                          <IconButton
                            onClick={() => setSearchOpen(true)}
                            sx={{
                              width: 24,
                              height: 24,
                              border: `1px solid ${theme.palette.vesoft.v2.border1}`,
                              backgroundColor: 'transparent',
                              '&:active,&:focus,&:hover': {
                                backgroundColor: theme.palette.vesoft.v2.bg3,
                                color: theme.palette.vesoft.v2.primary3,
                              },
                            }}
                          >
                            <SearchFilled sx={{ width: 16, height: 16 }} />
                          </IconButton>
                        )}
                      </Box>
                    )}

                    {/* Download */}
                    <Dropdown
                      trigger="click"
                      items={[
                        activeMenu === OutputMenu.ExplorerData
                          ? {
                              key: 'png',
                              label: <Typography fontSize={12}>{t('exportAsPng', { ns: 'console' })}</Typography>,
                              onClick: handleExportPngFullCanvas,
                            }
                          : null,
                        {
                          key: 'csv',
                          label: <Typography fontSize={12}>{t('exportAsCsv', { ns: 'console' })}</Typography>,
                          onClick: handleExpotCsv,
                        },
                        {
                          key: 'json',
                          label: <Typography fontSize={12}>{t('exportAsJson', { ns: 'console' })}</Typography>,
                          onClick: handleExportJson,
                        },
                      ].filter((item): item is NonNullable<typeof item> => Boolean(item))}
                    >
                      <IconButton
                        sx={{
                          width: 24,
                          height: 24,
                          border: `1px solid ${theme.palette.vesoft.v2.border1}`,
                          backgroundColor: 'transparent',
                          '&:active,&:focus,&:hover': {
                            backgroundColor: theme.palette.vesoft.v2.bg3,
                            color: theme.palette.vesoft.v2.primary3,
                          },
                        }}
                      >
                        <TrayArrowDown sx={{ width: 16, height: 16 }} />
                      </IconButton>
                    </Dropdown>
                  </Stack>
                </>
              )}
            </Stack>
            <Box
              sx={{
                height: isFullScreen ? 'calc(100% - 42px)' : result.code === 0 ? `${height}px` : 'auto',
                paddingTop: result.code === 0 ? '0' : '12px',
                overflow: isFullScreen ? 'auto' : 'auto',
              }}
            >
              <Suspense fallback={<Spinning />}>
                <ResultComponent activeMenu={activeMenu} result={result} searchValue={searchValue} />
              </Suspense>
            </Box>
          </ContentMain>
        </OutputContent>
        {!!result?.data?.summary?.totalServerTimeUs && (
          <OutputFooter
            sx={{
              position: 'relative',
              padding: '4px',
              fontSize: '12px',
              marginBottom: '-16px',
            }}
          >
            <Stack direction="row" alignItems="center" gap="12px">
              <Trans
                t={t}
                i18nKey={'executeInfo'}
                values={{
                  rowCount: result.data.summary.rowsCount,
                  serverTime: formatMicroseconds(result.data.summary.totalServerTimeUs),
                  durationTime: formatMicroseconds(result.data.duration!),
                }}
              />
              {(result?.warnings?.length || 0) >= 0 && <WarningCount result={result} />}
            </Stack>
            {!isFullScreen && result.code === 0 && (
              <Box
                onMouseDown={handleMouseDown}
                sx={{
                  position: 'absolute',
                  width: '100%',
                  bottom: 0,
                  height: '6px',
                  cursor: 'ns-resize',
                  backgroundColor: 'transparent',
                  transition: 'background-color 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                  '&:hover': {
                    backgroundColor: theme.palette.vesoft.v2.bg2,
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    width: '48px',
                    height: '3px',
                    backgroundColor: theme.palette.vesoft.v2.border1,
                    borderRadius: '4px',
                    opacity: 0,
                    transition: 'all 0.15s ease',
                  },
                  '&:hover::before': {
                    opacity: 0.8,
                    backgroundColor: theme.palette.vesoft.v2.text3,
                  },
                  ...(isResizing && {
                    backgroundColor: theme.palette.vesoft.v2.bg3,
                    '&::before, &:hover::before': {
                      opacity: 1,
                      backgroundColor: theme.palette.vesoft.v2.primary3,
                      height: '4px',
                    },
                  }),
                }}
              />
            )}
          </OutputFooter>
        )}
      </Collapse>
    </OutputContainer>
  );
}

export default observer(OutputBox);
