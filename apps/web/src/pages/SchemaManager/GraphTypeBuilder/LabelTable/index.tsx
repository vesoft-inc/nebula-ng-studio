import { useStore } from '@studio/stores';
import { Box, Chip, Tab, Tabs, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Table } from '@vesoft-inc/ui-components';
import { type MRT_ColumnDef } from 'material-react-table';

import { SyntheticEvent, useCallback, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';

interface LabelTableProps {
  readonly?: boolean;
}

enum TabType {
  Node = 'node',
  Edge = 'edge',
}

type LabeTableItem = { name: string; entityNames: string[] };

function LabelTable(props: LabelTableProps) {
  const { readonly } = props;
  const { schemaStore } = useStore().graphtypeStore;
  const { t } = useTranslation(['graphtype']);

  const TabList = useMemo(
    () => [
      {
        key: TabType.Node,
        title: t('nodeType', { ns: 'graphtype' }),
      },
      {
        key: TabType.Edge,
        title: t('edgeType', { ns: 'graphtype' }),
      },
    ],
    []
  );

  const [curTab, setCurTab] = useState<'node' | 'edge'>('node');

  const handleTabChange = (_: SyntheticEvent, value: TabType) => {
    setCurTab(value);
  };

  const getColumns = useCallback((): MRT_ColumnDef<LabeTableItem>[] => {
    const columns: MRT_ColumnDef<LabeTableItem>[] = [
      {
        accessorKey: 'name', //access nested data with dot notation
        header: t('label', { ns: 'graphtype' }),
        Cell: ({ row }) => <Chip label={row.original.name} sx={{ minWidth: 50 }} />,
      },
      {
        accessorKey: 'entityNames',
        header: t('entityNames', { ns: 'graphtype' }),
        Cell: ({ row }) => (
          <div>
            <Typography component="span">{row.original.entityNames.join(', ')}</Typography>
          </div>
        ),
      },
    ];
    return columns;
  }, [readonly]);

  const getDataSource = () => {
    if (!schemaStore) return [];
    if (curTab === TabType.Node) {
      const nodeTypeLabeMap = schemaStore.nodeTypeLabeMap;
      const entries = nodeTypeLabeMap.entries();
      return Array.from(entries).map(([label, entityNames]) => ({ name: label, entityNames }));
    }
    if (curTab === TabType.Edge) {
      const edgeTypeLabelMap = schemaStore.edgeTypeLabelMap;
      const entries = edgeTypeLabelMap.entries();
      return Array.from(entries).map(([label, entityNames]) => ({ name: label, entityNames }));
    }
    return [];
  };

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={curTab} onChange={handleTabChange} aria-label="basic tabs example">
          {TabList.map((tab) => (
            <Tab key={tab.key} label={tab.title} value={tab.key} />
          ))}
        </Tabs>
      </Box>
      <Box mt={2}>
        <Table columns={getColumns()} data={getDataSource()} />
      </Box>
    </>
  );
}

export default observer(LabelTable);
