import { observer } from 'mobx-react-lite';
import { Box, Button, IconButton, useTheme } from '@mui/material';
import { AddFilled, Delete } from '@vesoft-inc/icons';
import { Table } from '../../shared/index';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IGraphIndex } from '../types';
import { useModal } from '../../shared/useModal';
import { useSchema } from '../context';
import CreateGraphIndexModal from '../CreateGraphIndexDialog/index';
import type { GraphTypeElementOption } from '../CreateGraphIndexDialog/FormNormalIndex';

function GraphIndex({ graphName }: { graphName: string }) {
  const schemaStore = useSchema();
  const [indexData, setIndexData] = useState<IGraphIndex[]>([]);
  const params = { graphName };
  const theme = useTheme();
  const { t } = useTranslation(['graph', 'common']);
  const modalStore = useModal();
  const { message } = modalStore;
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const loadEntities = useCallback(
    async (graphName: string) =>
      (await schemaStore.getEntityTypeInfoByGraphName(graphName)) as GraphTypeElementOption[],
    []
  );

  useEffect(() => {
    fetchData();
  }, [graphName, schemaStore]);

  const fetchData = async () => {
    if (!params.graphName) return;
    setLoading(true);
    const indexInfo = await schemaStore.getIndexesInfo(params.graphName);
    setIndexData(indexInfo);
    setLoading(false);
  };

  const handleDeleteIndex = (index: IGraphIndex) => () => {
    if (!params.graphName) return;
    modalStore.severity(
      {
        title: t('deleteIndex', { ns: 'graph' }),
        content: t('confirmDeleteIndex', { ns: 'graph' }),
        onOk: async () => {
          const res = await schemaStore.dropIndex(params.graphName!, index.name);
          if (res.code === 0) {
            message.success(t('deleteIndexSuccess', { ns: 'graph' }));
            fetchData();
          }
          modalStore.hide();
        },
        okText: t('delete', { ns: 'common' }),
        cancelText: t('cancel', { ns: 'common' }),
      },
      {
        slotProps: {
          footer: {
            onCancel: () => {
              modalStore.hide();
            },
          },
        },
      }
    );
  };

  const columns: MRT_ColumnDef<IGraphIndex>[] = [
    {
      accessorKey: 'name',
      header: t('indexName', { ns: 'graph' }),
    },
    {
      accessorKey: 'state',
      header: t('state', { ns: 'graph' }),
    },
    {
      accessorKey: 'index_type',
      header: t('indexType', { ns: 'graph' }),
    },
    {
      accessorKey: 'entity_type',
      header: t('entityType', { ns: 'graph' }),
    },
    {
      accessorKey: 'element_type',
      header: t('elementType', { ns: 'graph' }),
    },
    {
      accessorKey: 'properties',
      header: t('property', { ns: 'graph' }),
      Cell: ({ row }) => row.original.properties.join(', '),
    },
    {
      accessorKey: 'operation',
      header: t('operation', { ns: 'common' }),
      Cell: ({ row }) => (
        <Box display="flex" alignItems="center">
          <IconButton size="small" onClick={handleDeleteIndex(row.original)}>
            <Delete color="error" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <>
      <Box display="flex" justifyContent="flex-end" alignItems="center" sx={{ mb: theme.spacing(1.5) }}>
        <Button variant="contained" startIcon={<AddFilled />} onClick={() => setModalOpen(true)}>
          {t('createIndex', { ns: 'graph' })}
        </Button>
      </Box>
      <Table
        columns={columns}
        data={indexData}
        enableColumnPinning
        // renderTopToolbarCustomActions={() => (
        //   <Box display="flex" alignItems="center" sx={{ background: 'red' }}>
        //     <Button variant="contained" startIcon={<AddFilled />} onClick={() => setModalOpen(true)}>
        //       {t('createIndex', { ns: 'graph' })}
        //     </Button>
        //   </Box>
        // )}
        state={{
          isLoading: loading,
        }}
        // enableTopToolbar
      />

      <CreateGraphIndexModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        graphName={params.graphName!}
        runGql={schemaStore.services.execute}
        loadEntities={loadEntities}
        onOk={() => {
          fetchData();
          setModalOpen(false);
        }}
      />
    </>
  );
}

export default observer(GraphIndex);
