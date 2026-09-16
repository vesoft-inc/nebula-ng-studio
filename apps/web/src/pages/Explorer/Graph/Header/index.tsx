import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Box,
  Breadcrumbs,
  // Link,
  Typography,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  useTheme,
  TextField,
  Button,
} from '@mui/material';
import { ArrowBackFilled, ContentSave, SearchFilled, TrayArrowUp } from '@vesoft-inc/icons';
import {
  // Link as RouterLink,
  useBlocker,
  useNavigate,
} from 'react-router-dom';
import { useModal, useStore } from '@studio/stores';
import { OpenableSearchInput, ToolIconButton } from './styles';
import { useTranslation } from 'react-i18next';
import { EdgeValue, RawEntityType, Snapshot, VertexValue } from '@studio/interfaces/explorer';
import { Dropdown } from '@vesoft-inc/ui-components';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { ListboxComponent, OptionItem, StyledPopper } from './VirtualList';
import { downloadCSVFiles } from '@vesoft-inc/utils';
import { generateFullGraphCanvas } from '@studio/utils/graph/base/screenshot';

function GraphHeader() {
  const navigate = useNavigate();
  const { explorerStore } = useStore();
  const { graphWorkspace, currentSchema } = explorerStore;
  const backToExplorer = useCallback(() => navigate('/explorer/snapshots'), [navigate]);

  const { currentSnapshot, graph } = graphWorkspace;
  const { name } = currentSnapshot || {};
  const { message } = useModal();
  const theme = useTheme();
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const { t } = useTranslation(['common', 'explorer']);
  const modal = useModal();

  useEffect(() => {
    if (!searchOpen) return;

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return graphWorkspace.graph.shouldBlockRouter && currentLocation.pathname !== nextLocation.pathname;
  });

  const generateThumbnailCanvas = () => {
    return new Promise<HTMLCanvasElement>((resolve, reject) => {
      if (!graph?.twoGraph) {
        reject(new Error('Graph canvas is not ready'));
        return;
      }
      const oldZoom = graph.twoGraph.instance.zoom();
      const center: { x: number; y: number } = graph.twoGraph.instance.centerAt();
      const canvas2d = graph.twoGraph.canvas;
      if (!canvas2d) {
        reject(new Error('Graph canvas is not ready'));
        return;
      }
      graph.twoGraph.instance.zoomToFit(0);
      const canvas: HTMLCanvasElement = document.createElement('canvas');
      canvas.width = canvas2d.width;
      canvas.height = canvas2d.height;
      graph.twoGraph.instance.zoom(oldZoom, 0);
      graph.twoGraph.instance.centerAt(center.x, center.y, 0);
      setTimeout(() => {
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Unable to create thumbnail canvas'));
            return;
          }
          ctx.fillStyle = theme.palette.vesoft.background.secondary;
          ctx.fillRect(0, 0, canvas2d.width, canvas2d.height);
          ctx.drawImage(canvas2d, 0, 0);
          resolve(canvas);
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  };

  const handleSave = async (): Promise<boolean> => {
    if (savingRef.current) return false;

    savingRef.current = true;
    setIsSaving(true);
    try {
      const data = graph.toSnapShotData();
      const canvas = await generateThumbnailCanvas();
      const thumbnail = canvas.toDataURL('image/png');
      const res = await explorerStore.saveSnapShotDetail({
        ...(graphWorkspace.currentSnapshot || {}),
        thumbnail,
        data,
        schemaPath: currentSchema?.path,
      } as Snapshot);
      if (res.code !== 0) return false;

      graph.updateShouldBlockRouter(false);
      message.success(t('saveSuccess', { ns: 'common' }));
      return true;
    } catch {
      message.error(t('error', { ns: 'common' }));
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (blocker.state === 'blocked') {
      modal.warning(
        {
          title: t('leavePageTipTitle', { ns: 'explorer' }),
          content: t('leavePageTipContent', { ns: 'explorer' }),
          onOk: () => {
            blocker.proceed();
            modal.hide();
          },
          onCancel: () => {
            blocker.reset();
            modal.hide();
          },
          okText: t('confirmLeave', { ns: 'explorer' }),
          cancelText: t('cancelLeave', { ns: 'explorer' }),
        },
        {
          slotProps: {
            footer: {
              slotProps: {
                extraActions: (
                  <Button
                    variant="contained"
                    sx={{ ml: 1 }}
                    onClick={async () => {
                      const saved = await handleSave();
                      if (!saved) return;
                      blocker.proceed();
                      modal.hide();
                    }}
                  >
                    {t('saveAndLeave', { ns: 'explorer' })}
                  </Button>
                ),
              },
            },
          },
        }
      );
    }
  }, [blocker]);

  const handleExportPngFullCanvas = () => {
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
              const filename = (graphWorkspace.currentSnapshot?.name || 'graph') + '.png';
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

  const handleExportJson = () => {
    const data = graph.toSnapShotData();
    const result = explorerStore.exportSnapshotTransfer(data);
    const json = JSON.stringify(result);
    const _utf = '\uFEFF';
    if (window.Blob && window.URL) {
      const jsonBlob = new Blob([_utf + json], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(jsonBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${graphWorkspace.currentSnapshot?.name}.json`;
      link.click();
    }
  };

  const handleExportCsv = () => {
    const { nodes, links } = graphWorkspace.graph;
    const data = [...Array.from(nodes).map((node) => node.data), ...Array.from(links).map((link) => link.data)];

    if (data.length === 0) {
      const emptyCsv = 'raw,type,value,x,y\n';
      const blob = new Blob([emptyCsv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${graphWorkspace.currentSnapshot?.name}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } else {
      downloadCSVFiles<VertexValue | EdgeValue>({
        data,
        title: `${graphWorkspace.currentSnapshot?.name}`,
      });
    }
  };

  const OPTIONS = Array.from(graphWorkspace.graph.nowDataMap.values()).sort((a, b) => (a.id! < b.id! ? -1 : 1));

  const handleSelectOption = (item: NodeObject | LinkObject) => {
    graph.clearLinksSelected();
    graph.clearNodesSelected();
    if (item.data.type === RawEntityType.NODE) {
      graph.twoGraph?.instance.centerAt(item.x as number, item.y as number);
      graph.selectNodes([item as NodeObject]);
      return;
    }
    if (item.data.type === RawEntityType.EDGE) {
      const source = item.source as NodeObject;
      const target = item.target as NodeObject;
      const x = (((source.x as number) + target.x!) as number) / 2;
      const y = (((source.y as number) + target.y!) as number) / 2;
      graph.twoGraph?.instance.centerAt(x, y);
      graph.selectLinks([item as LinkObject]);
    }
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      height="58px"
      flex="0 0 58px"
      px={1.5}
      borderBottom={(theme) => `${theme.palette.vesoft.textColor6} 1px solid`}
    >
      <Box flex="0 0 500px" display="flex" alignItems="center">
        <IconButton disableRipple aria-label="back" sx={{ mr: 1 }} onClick={backToExplorer}>
          <ArrowBackFilled />
        </IconButton>
        <Breadcrumbs aria-label="breadcrumb" separator={<Box px={0.5}>/</Box>}>
          <Box onClick={backToExplorer} sx={{ cursor: 'pointer' }}>
            <Box
              sx={{
                color: theme.palette.vesoft.v2.primary3,
              }}
            >
              {t('explorerList', { ns: 'common' })}
            </Box>
          </Box>
          <Typography maxWidth={320} overflow="hidden" textOverflow="ellipsis">
            {name ? (
              <Tooltip title={name} placement="bottom-start">
                <Box component="span" sx={{ whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
                  {name}
                </Box>
              </Tooltip>
            ) : (
              <Skeleton width={120} />
            )}
          </Typography>
        </Breadcrumbs>
      </Box>
      <Stack flex="0 0 300px" direction="row" alignItems="center" justifyContent="flex-end" spacing={0}>
        <Box
          position="relative"
          sx={{
            width: searchOpen ? 320 : 36,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            mr: 0.5,
            transition: 'width 300ms ease',
          }}
        >
          <OpenableSearchInput
            freeSolo
            disableListWrap
            multiple={false}
            options={OPTIONS}
            inputValue={searchValue}
            size="small"
            aria-hidden={!searchOpen}
            sx={{
              opacity: searchOpen ? 1 : 0,
              pointerEvents: searchOpen ? 'auto' : 'none',
              transform: searchOpen ? 'scaleX(1)' : 'scaleX(0.1125)',
              transformOrigin: 'right center',
              transition: searchOpen
                ? 'transform 300ms ease, opacity 140ms ease 60ms'
                : 'transform 300ms ease, opacity 100ms ease',
            }}
            onChange={(_, newValue, reason) => {
              if (reason === 'selectOption') {
                handleSelectOption(newValue as NodeObject | LinkObject);
              }
            }}
            onInputChange={(_, value) => setSearchValue(value)}
            PopperComponent={StyledPopper}
            ListboxComponent={ListboxComponent}
            disableCloseOnSelect
            getOptionKey={(option) => (option as NodeObject | LinkObject).id!}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue) return [];
              return (options as (NodeObject | LinkObject)[]).filter((item) => {
                for (const key in item.data.value.properties) {
                  const value = item.data.value.properties[key];
                  if (value?.toString().includes(inputValue)) {
                    return true;
                  }
                }
                return false;
              });
            }}
            getOptionLabel={() => searchValue}
            autoComplete={false}
            renderOption={(props, option, state) => {
              const item = option as NodeObject | LinkObject;
              return [props, <OptionItem item={item} state={state} />, state.index] as React.ReactNode;
            }}
            onBlur={() => {
              if (searchOpen) {
                setSearchValue('');
                setSearchOpen(false);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                inputRef={searchInputRef}
                size="small"
                label={t('searchInCanvas', { ns: 'explorer' })}
                inputProps={{ ...params.inputProps, tabIndex: searchOpen ? 0 : -1 }}
              />
            )}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchValue('');
                setSearchOpen(false);
              }
            }}
          />
          <ToolIconButton
            title={t('searchInCanvas', { ns: 'common' })}
            aria-hidden={searchOpen}
            tabIndex={searchOpen ? -1 : 0}
            onClick={() => {
              setSearchValue('');
              setSearchOpen(true);
            }}
            sx={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: searchOpen ? 0 : 1,
              pointerEvents: searchOpen ? 'none' : 'auto',
              transition: searchOpen ? 'opacity 100ms ease' : 'opacity 120ms ease 180ms',
            }}
          >
            <SearchFilled fontSize="medium" aria-label="SearchFilled" />
          </ToolIconButton>
        </Box>
        <ToolIconButton disabled={isSaving} onClick={handleSave} title={t('save', { ns: 'common' })}>
          <ContentSave fontSize="medium" aria-label="ContentSave" />
        </ToolIconButton>
        <Dropdown
          trigger="hover"
          items={[
            {
              key: 'png',
              label: <Typography fontSize={12}>{t('exportAsPng', { ns: 'explorer' })}</Typography>,
              onClick: handleExportPngFullCanvas,
            },
            {
              key: 'json',
              label: <Typography fontSize={12}>{t('exportAsJson', { ns: 'explorer' })}</Typography>,
              onClick: handleExportJson,
            },
            {
              key: 'csv',
              label: <Typography fontSize={12}>{t('exportAsCsv', { ns: 'explorer' })}</Typography>,
              onClick: handleExportCsv,
            },
          ]}
        >
          <ToolIconButton title={t('export', { ns: 'common' })}>
            <TrayArrowUp fontSize="medium" />
          </ToolIconButton>
        </Dropdown>
        {/* <ToolIconButton aria-label="CloseFilled" onClick={backToExplorer}>
          <CloseFilled fontSize="medium" />
        </ToolIconButton> */}
      </Stack>
    </Box>
  );
}

const observedGraphHeader = observer(GraphHeader);

export default observedGraphHeader;
