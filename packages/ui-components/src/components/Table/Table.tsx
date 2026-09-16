import { Box, Typography, useTheme } from '@mui/material';
import { MRT_RowData, MRT_TableOptions, MaterialReactTable, useMaterialReactTable } from 'material-react-table';
export interface TableProps<T extends MRT_RowData> extends MRT_TableOptions<T> {
  rowSize?: 'small' | 'medium';
  expand?: boolean;
  enablePagination?: boolean;
  localeText?: {
    noDataTip: string;
  };
}

const Size_Height_Map = {
  header: {
    small: 32,
    medium: 36,
  },
  row: {
    small: 36,
    medium: 48,
  },
};

const Table = <T extends MRT_RowData>(props: TableProps<T>) => {
  const { rowSize = 'medium', expand = false, enablePagination = true, localeText } = props;
  const theme = useTheme();
  const table = useMaterialReactTable({
    paginationDisplayMode: 'pages',
    muiPaginationProps: {
      color: 'primary',
      shape: 'circular',
      showRowsPerPage: false,
      variant: 'outlined',
    },
    enableSorting: false,
    enableTopToolbar: false,
    enableColumnFilters: false,
    enableHiding: false,
    enableColumnPinning: true,
    enableColumnActions: false,
    enableFullScreenToggle: false,
    enableExpanding: expand,
    enableExpandAll: false,
    initialState: {
      density: 'comfortable',
    },
    renderEmptyRowsFallback: () => {
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.vesoft.v2.bg1,
            height: theme.spacing(10),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.palette.vesoft.v2.text5,
            fontSize: 14,
            fontWeight: 400,
          }}
        >
          <Typography sx={{ transform: 'skewX(-15deg)' }}>
            {localeText?.noDataTip || 'No records to display'}
          </Typography>
        </Box>
      );
    },
    muiDetailPanelProps: () => ({
      sx: {
        backgroundColor: theme.palette.vesoft.v2.bg2,
      },
    }),
    muiExpandButtonProps: ({ row, table }) => ({
      onClick: () => table.setExpanded({ [row.id]: !row.getIsExpanded() }), //only 1 detail panel open at a time
      sx: {
        transform: row.getIsExpanded() ? 'rotate(180deg)' : 'rotate(-90deg)',
        transition: 'transform 0.2s',
      },
    }),
    muiTableProps: {
      sx: {
        '& .MuiTableCell-root': {
          fontFamily: theme.typography.fontFamily,
          fontSize: 14,
        },
        // hover background color
        '& .MuiTableRow-root:hover td:after': {
          backgroundColor: theme.palette.vesoft.v2.bg3,
        },
      },
    },
    muiTableBodyCellProps: {
      sx: {
        borderBottom: `${theme.palette.vesoft.v2.border2} 1px solid`,
      },
    },
    muiTableHeadRowProps: {
      sx: {
        borderBottom: `${theme.palette.vesoft.v2.border2} 1px solid`,
        bgcolor: `${theme.palette.vesoft.v2.bg3}`,
        height: Size_Height_Map.header[rowSize!],
        '& .MuiTableCell-root': {
          fontSize: 14,
          paddingTop: theme.spacing(1),
          paddingBottom: theme.spacing(1),
        },
      },
    },
    muiSkeletonProps: {
      animation: 'wave',
    },
    muiTablePaperProps: {
      elevation: 0,
      sx: {
        borderRadius: 0,
        border: 'none',
        height: '100%',
        backgroundColor: 'transparent',
      },
    },
    muiBottomToolbarProps: {
      sx: {
        boxShadow: 'none',
        backgroundColor: 'transparent',
        display: enablePagination ? 'flex' : 'none',
      },
    },
    ...props,
  });

  return <MaterialReactTable table={table} />;
};

export default Table;
