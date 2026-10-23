import { observer } from 'mobx-react-lite';
import { DatabaseSearch, GraphExpand, TransitConnectionVariant } from '@vesoft-inc/icons';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import { SiderPanel } from '@studio/interfaces/explorer/explorer';
import { useExplorerStore } from '@studio/pages/Explorer/context';
import { type Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Box } from '@mui/material';

export default observer(function GraphQuery() {
  const { graphWorkspace } = useExplorerStore();
  const { updateActiveSiderKey } = graphWorkspace;
  const color = (theme: Theme) => theme.palette.vesoft.textColor2;
  const { t } = useTranslation(['explorer']);

  const items = useMemo(
    () => [
      {
        icon: <DatabaseSearch />,
        text: t('queryNode', { ns: 'explorer' }),
        key: 'queryNode',
        onClick: () => updateActiveSiderKey(SiderPanel.GraphQueryNode),
      },
      {
        icon: <GraphExpand />,
        text: t('exploreRelation', { ns: 'explorer' }),
        key: 'exploreRelation',
        onClick: () => updateActiveSiderKey(SiderPanel.GraphExploreRelation),
      },
      {
        icon: <TransitConnectionVariant />,
        text: t('queryPath', { ns: 'explorer' }),
        key: 'queryPath',
        onClick: () => updateActiveSiderKey(SiderPanel.GraphQueryPath),
      },
    ],
    []
  );

  return (
    <List disablePadding>
      {items.map((item) => (
        <Box key={item.key}>
          <ListItemButton onClick={item.onClick}>
            <ListItemIcon sx={{ minWidth: 0, mr: 2, color }}>{item.icon}</ListItemIcon>
            <ListItemText sx={{ color }} primary={item.text} />
          </ListItemButton>
          <Divider />
        </Box>
      ))}
    </List>
  );
});
