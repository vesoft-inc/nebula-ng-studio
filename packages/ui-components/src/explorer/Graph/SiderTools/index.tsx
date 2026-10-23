import { FunctionComponent, Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import Box from '@mui/material/Box';
import Slide from '@mui/material/Slide';
import { FilterOutline, TagMultipleOutline, TextBoxSearchOutline } from '@vesoft-inc/icons';
import SiderMenu from '../../../graph/components/SiderMenu/index';
import { useExplorerStore } from '../../context';
import { SiderPanel } from '../../../graph/types/explorer';
import { NoopComponent } from '../../../graph/helpers';
import { SiderDrawer, SiderDrawerWrapper } from './styles';
import { useTranslation } from 'react-i18next';
import { Badge } from '@mui/material';

const PanelMap: { [k in SiderPanel]?: FunctionComponent } = {
  [SiderPanel.GraphQuery]: lazy(() => import('./Panels/GraphQuery/index')),
  [SiderPanel.GraphQueryNode]: lazy(() => import('./Panels/GraphQuery/QueryNode/index')),
  [SiderPanel.GraphQueryPath]: lazy(() => import('./Panels/GraphQuery/QueryPath/index')),
  [SiderPanel.GraphExploreRelation]: lazy(() => import('./Panels/GraphQuery/ExploreRelation/index')),
  [SiderPanel.GraphFilter]: lazy(() => import('./Panels/GraphFilter/index')),
  [SiderPanel.GraphProperty]: lazy(() => import('./Panels/GraphProperty/index')),
};

const GRAPH_QUERY_KEYS = new Set([
  SiderPanel.GraphQuery,
  SiderPanel.GraphQueryNode,
  SiderPanel.GraphQueryPath,
  SiderPanel.GraphExploreRelation,
]);

export default observer(function GraphSiderTools() {
  const explorerStore = useExplorerStore();
  const { graphWorkspace } = explorerStore;
  const { t } = useTranslation(['explorer']);
  const { activeSiderKey } = graphWorkspace;
  const { enabledFilterConditionNum } = graphWorkspace.graph;
  const siderItems = useMemo(
    () => [
      {
        key: SiderPanel.GraphQuery,
        tooltip: { title: t('graphQuery', { ns: 'explorer' }) },
        icon: <TextBoxSearchOutline fontSize="medium" />,
        sx: { height: 48 },
      },
      // {
      //   key: SiderPanel.GraphProperty,
      //   tooltip: { title: 'GraphProperty' },
      //   icon: <GraphCalculation fontSize="medium" />,
      //   sx: { height: 48 },
      // },
      {
        key: SiderPanel.GraphFilter,
        tooltip: { title: t('graphFilter', { ns: 'explorer' }) },
        icon:
          activeSiderKey !== SiderPanel.GraphFilter ? (
            <Badge
              badgeContent={enabledFilterConditionNum}
              max={99}
              sx={{
                color: (theme) => theme.palette.vesoft.v2.text6,
                '& .MuiBadge-badge': {
                  fontSize: '0.75rem', // 调整字体大小
                  minWidth: '14px', // 调整最小宽度
                  height: '14px', // 调整高度
                  padding: '0 4px', // 调整内边距
                  backgroundColor: (theme) => theme.palette.vesoft.v2.primary3,
                },
              }}
              showZero={false}
            >
              <FilterOutline fontSize="medium" sx={{ color: (theme) => theme.palette.vesoft.v2.text2 }} />
            </Badge>
          ) : (
            <FilterOutline fontSize="medium" />
          ),
        sx: { height: 48 },
      },
      {
        key: SiderPanel.GraphProperty,
        tooltip: { title: t('graphProperty', { ns: 'explorer' }) },
        icon: <TagMultipleOutline fontSize="medium" />,
        sx: { height: 48 },
      },
    ],
    [enabledFilterConditionNum, activeSiderKey]
  );
  const onMenuClick = useCallback(
    (key: string) => {
      const { updateActiveSiderKey, activeSiderKey } = graphWorkspace;
      if (key === SiderPanel.GraphQuery && activeSiderKey && GRAPH_QUERY_KEYS.has(activeSiderKey)) {
        updateActiveSiderKey();
        return;
      }
      updateActiveSiderKey(activeSiderKey === key ? undefined : (key as SiderPanel));
    },
    [graphWorkspace]
  );

  useEffect(() => () => graphWorkspace.updateActiveSiderKey(), []);

  const Comp = activeSiderKey ? PanelMap[activeSiderKey] || NoopComponent : NoopComponent;
  const realActiveSiderKey = GRAPH_QUERY_KEYS.has(activeSiderKey!) ? SiderPanel.GraphQuery : activeSiderKey;
  return (
    <Box position="relative">
      <SiderMenu
        wrapSx={{ height: '100%', width: 48 }}
        items={siderItems}
        activeKey={realActiveSiderKey}
        onMenuClick={onMenuClick}
      />
      <SiderDrawerWrapper>
        <Slide direction="right" in={!!activeSiderKey} mountOnEnter unmountOnExit>
          <SiderDrawer>
            <Suspense>
              <Box
                height="100%"
                width={280}
                padding={
                  activeSiderKey === SiderPanel.GraphQuery
                    ? undefined
                    : (theme) => `${theme.spacing(1)} ${theme.spacing(2)}`
                }
              >
                <Comp />
              </Box>
            </Suspense>
          </SiderDrawer>
        </Slide>
      </SiderDrawerWrapper>
    </Box>
  );
});
