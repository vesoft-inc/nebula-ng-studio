import { observer } from 'mobx-react-lite';
import Box from '@mui/material/Box';
import { Table } from '@vesoft-inc/ui-components';
import { ConsoleResult } from '@vesoft-inc/utils';
import { useTranslation } from 'react-i18next';
import { MRT_Localization_ZH_HANS } from 'material-react-table/locales/zh-Hans';
import { JSONBig, transformNebulaResult } from '@studio/utils';
import { Language } from '@studio/utils/i18n';

function TableResult({ result, searchValue }: { result: ConsoleResult; searchValue?: string }) {
  const { t, i18n } = useTranslation(['graph']);
  const { headers = [], tables = [] } = result.data || {};
  const columns = (headers || []).map((header) => ({
    accessorFn: (row: Record<string, string>) => row[header],
    header,
  }));
  const allData = tables.map((item) => {
    const obj = (headers || []).reduce(
      (acc, key) => {
        acc[key] = JSONBig.stringify(transformNebulaResult(item[key]));
        return acc;
      },
      {} as Record<string, string>
    );
    return obj;
  });

  // Filter data based on search value
  const data = searchValue
    ? allData.filter((row) =>
        Object.values(row).some((value) => value.toLowerCase().includes(searchValue.toLowerCase()))
      )
    : allData;

  const localization = i18n.language === Language.EN_US ? undefined : MRT_Localization_ZH_HANS;

  return (
    <Box m={0} p={0} height="100%" overflow="hidden">
      <Table
        localeText={{
          noDataTip: t('noDataTip', { ns: 'graph' }),
        }}
        columns={columns}
        data={data}
        enableStickyHeader
        enableSorting
        enableBottomToolbar={data.length > 5}
        muiPaginationProps={{
          size: 'small',
          sx: {
            boxShadow: 'none',
          },
        }}
        muiTableHeadRowProps={{
          sx: {
            boxShadow: 'none',
          },
        }}
        muiTableHeadProps={{
          sx: {
            tr: {
              backgroundColor: (theme) => theme.palette.vesoft.v2.bg5,
              height: '32px',
            },
          },
        }}
        muiTablePaperProps={{
          elevation: 0,
          sx: {
            borderRadius: 0,
            border: 'none',
            height: '100%',
            background: (theme) => theme.palette.vesoft.v2.bg1,
          },
        }}
        muiBottomToolbarProps={{
          sx: {
            boxShadow: 'none',
            background: (theme) => theme.palette.vesoft.v2.bg1,
          },
        }}
        paginationDisplayMode="pages"
        muiTableContainerProps={{ sx: { height: 'calc(100% - 40px)' } }}
        localization={localization}
      />
    </Box>
  );
}

const observedTableResult = observer(TableResult);

export default observedTableResult;
