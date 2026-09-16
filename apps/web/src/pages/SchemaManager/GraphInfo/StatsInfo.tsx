import { IGraphStats } from '@studio/interfaces';
import { useModal, useStore } from '@studio/stores';
import { Box, Button } from '@mui/material';
import { Table } from '@vesoft-inc/ui-components';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

function StatsInfo() {
  const params = useParams<{ graphName: string }>();
  const { t } = useTranslation(['graph', 'common']);
  const { schemaStore } = useStore();
  const [statsData, setStatsData] = useState<IGraphStats[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalInfo, setTotalInfo] = useState<{
    totalNode: number;
    totalEdge: number;
  }>({
    totalNode: 0,
    totalEdge: 0,
  });
  const { message } = useModal();

  useEffect(() => {
    // showJobs();
    showStats({ isManual: false });
  }, [location.pathname]);

  // TODO: Display job information of the graph's job, including [stats] in the call to showStats
  // const showJobs = async () => {
  //   if (!params.graphName) return;
  //   const data = await schemaStore.showJobs();
  //   return data;
  // };

  const showStats = async (options: Parameters<typeof schemaStore.showStats>[1]) => {
    setStatsData([]);

    if (!params.graphName) return;
    setLoading(true);
    const data = await schemaStore.showStats(params.graphName, options);
    if (data.length < 2) {
      setLoading(false);
      return;
    }

    const items = data.slice(0, 2);
    const nodeTotalCount = items.find((item) => item.element_type === 'Node')?.total_num ?? 0;
    const edgeTotalCount = items.find((item) => item.element_type === 'Edge')?.total_num ?? 0;
    setTotalInfo({
      totalNode: nodeTotalCount,
      totalEdge: edgeTotalCount,
    });

    setStatsData(data.slice(2));
    setLoading(false);
  };

  const getColumns = useCallback(
    () => [
      {
        accessorKey: 'entry_name',
        header: t('entryName', { ns: 'graph' }),
      },
      {
        accessorKey: 'element_type',
        header: t('entryType', { ns: 'graph' }),
      },
      {
        accessorKey: 'total_num',
        header: t('totalNum', { ns: 'graph' }),
      },
    ],
    []
  );

  const handleExecStats = async () => {
    if (!params.graphName) return;
    const res = await schemaStore.execStats(params.graphName);
    if (res.code === 0) {
      message.success(t('execStatsSuccess', { ns: 'graph' }));
      showStats({ isManual: true });
    }
  };

  return (
    <>
      <Box display="flex" alignItems="center" justifyContent="space-between" mt={2} mb={2}>
        <Box display="flex" alignItems="center">
          <Box>
            <Box component="span" color={(theme) => theme.palette.vesoft.textAssistColor5}>
              {t('totalNode', { ns: 'graph' })}
            </Box>{' '}
            {totalInfo.totalNode}
          </Box>
          <Box ml={2}>
            <Box component="span" color={(theme) => theme.palette.vesoft.textAssistColor5}>
              {t('totalEdge', { ns: 'graph' })}
            </Box>
            {totalInfo.totalEdge}
          </Box>
        </Box>
        <Button variant="contained" onClick={handleExecStats}>
          {t('execStats', { ns: 'graph' })}
        </Button>
      </Box>
      <Table
        state={{
          isLoading: loading,
        }}
        columns={getColumns()}
        data={statsData}
        enableColumnPinning
        // enableTopToolbar
      />
    </>
  );
}

export default observer(StatsInfo);
