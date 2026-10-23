import { GraphEntityType } from '@vesoft-inc/utils';
import { observer } from 'mobx-react-lite';

import { List } from '@mui/material';
import LabelItem, { LabelTypeItem } from './LabelItem';
import type { GraphWorkspaceStore } from '@studio/stores/graph/workspace';

function LabelMode({
  entityType,
  explorerItem,
}: {
  entityType: GraphEntityType | 'all';
  explorerItem: GraphWorkspaceStore;
}) {
  const { graph } = explorerItem;
  const countByLabel = () => {
    const { nodes, links } = graph;
    const labelCountMap = new Map<string, LabelTypeItem>();
    if (entityType === 'all' || entityType === GraphEntityType.Node) {
      nodes.forEach((node) => {
        const { labels } = node.data.value;
        labels.forEach((label: string) => {
          if (labelCountMap.has(label)) {
            labelCountMap.get(label)!.count++;
          } else {
            labelCountMap.set(label, { label, count: 1 });
          }
        });
      });
    }
    if (entityType === 'all' || entityType === GraphEntityType.Edge) {
      links.forEach((link) => {
        const { labels } = link.data.value;
        labels.forEach((label: string) => {
          if (labelCountMap.has(label)) {
            labelCountMap.get(label)!.count++;
          } else {
            labelCountMap.set(label, { label, count: 1 });
          }
        });
      });
    }
    return labelCountMap;
  };

  const labelInfo = countByLabel();

  const handleItemClick = (item: LabelTypeItem) => () => {
    console.log(item);
  };

  return (
    <List sx={{ width: '100%', overflowY: 'auto', paddingTop: 0 }} component="nav">
      {Array.from(labelInfo).map(([_, item], index) => (
        <LabelItem key={index} item={item} selected={false} onClick={handleItemClick(item)} />
      ))}
    </List>
  );
}

export default observer(LabelMode);
