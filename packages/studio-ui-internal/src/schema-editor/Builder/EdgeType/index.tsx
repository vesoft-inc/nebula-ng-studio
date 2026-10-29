import { Box, Button, Chip, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { AddFilled, ArrowBackFilled, ArrowForwardFilled, Delete, EditFilled, Minus } from '@vesoft-inc/icons';
import { useTranslation } from 'react-i18next';
import { Table } from '../../../shared/index';
import { observer } from 'mobx-react-lite';
import { type MRT_ColumnDef } from 'material-react-table';
import { EdgeDirectionType, MultiEdgeKeyMode } from '@vesoft-inc/studio-core/contracts';

import { ActionContainer } from './styles';
import { useGraphTypeStore } from '../../context';
import { IEdgeTypeItem, IProperty } from '../../../schema/types';
import { useCallback, useMemo, useState } from 'react';
import { getLabelColor } from '../../../shared/utilities';
import EdgeTypeConfigModal from './EdgeTypeConfigModal';

interface EdgeTypeTableProps {
  readonly?: boolean;
}

function EdgeTypeTable(props: EdgeTypeTableProps) {
  const { readonly } = props;
  const { schemaStore } = useGraphTypeStore();
  const { t } = useTranslation(['graphtype']);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEdgeType, setEditEdgeType] = useState<IEdgeTypeItem | undefined>();

  const handleEditEdgeType = (edgeType: IEdgeTypeItem) => () => {
    setEditEdgeType(edgeType);
    setModalOpen(true);
  };

  const handleDeleteEdgeType = (edgeType: IEdgeTypeItem) => () => {
    schemaStore?.deleteEdgeType(edgeType);
  };

  const multiKeyModeOptions = useMemo(
    () => [
      {
        label: t('multiKeyMode_none', { ns: 'graphtype' }),
        value: MultiEdgeKeyMode.None,
      },
      {
        label: t('multiKeyMode_auto', { ns: 'graphtype' }),
        value: MultiEdgeKeyMode.Auto,
      },
      {
        label: t('multiKeyMode_customize', { ns: 'graphtype' }),
        value: MultiEdgeKeyMode.Customize,
      },
    ],
    [t]
  );

  const getColumns = (): MRT_ColumnDef<IEdgeTypeItem>[] => {
    const columns: MRT_ColumnDef<IEdgeTypeItem>[] = [
      {
        accessorKey: 'name', //access nested data with dot notation
        header: t('edgeTypeName', { ns: 'graphtype' }),
      },
      {
        accessorKey: 'labels', //normal accessorKey
        header: t('labels', { ns: 'graphtype' }),
        Cell: ({ row }) =>
          (row.original.labels || []).map((label, index) => {
            const [color, backgroundColor] = getLabelColor(index, theme);
            return (
              <Chip
                sx={{
                  borderColor: color,
                  backgroundColor,
                  color,
                  minWidth: 40,
                  '&:not(:first-of-type)': { ml: 1 },
                }}
                key={index}
                label={label}
                variant="outlined"
              />
            );
          }),
      },
      {
        header: t('relation', { ns: 'graphtype' }),
        Cell: ({ row }) => (
          <Stack direction="row" spacing={2} display="flex" alignItems="center">
            <Typography>{row.original.srcNode.name}</Typography>
            <Typography display="flex" alignItems="center">
              {row.original.direction === EdgeDirectionType.Forward && <ArrowForwardFilled />}
              {row.original.direction === EdgeDirectionType.Backward && <ArrowBackFilled />}
              {row.original.direction === EdgeDirectionType.Undirected && <Minus />}
            </Typography>
            <Typography>{row.original.dstNode.name}</Typography>
          </Stack>
        ),
      },
      {
        accessorKey: 'multiEdgeKeyMode',
        header: t('multiKeyMode', { ns: 'graphtype' }),
        Cell: ({ row }) => multiKeyModeOptions.find((item) => item.value === row.original.multiEdgeKeyMode)?.label,
      },
    ];
    if (!readonly) {
      columns.push({
        header: t('operation', { ns: 'graphtype' }),
        Cell: ({ row }) => (
          <Box display="flex" alignItems="center">
            <IconButton size="small" onClick={handleEditEdgeType(row.original)}>
              <EditFilled />
            </IconButton>
            <IconButton size="small" onClick={handleDeleteEdgeType(row.original)} sx={{ marginLeft: 2 }}>
              <Delete />
            </IconButton>
          </Box>
        ),
      });
    }
    return columns;
  };

  const getSubColumns = useCallback(
    (num: number) =>
      [
        {
          accessorKey: 'name', //access nested data with dot notation
          header: t('propertyName', { ns: 'graphtype' }),
          Header: ({ column }) => (
            <Typography>
              {column.columnDef.header} ({num})
            </Typography>
          ),
        },
        {
          accessorKey: 'type',
          header: t('propertyType', { ns: 'graphtype' }),
          Header: ({ column }) => <Typography>{column.columnDef.header}</Typography>,
        },
        {
          accessorKey: 'nullable',
          header: t('nullable', { ns: 'graphtype' }),
          Cell: ({ row }) => (row.original.nullable ? 'Nullable' : 'Not Null'),
        },
        {
          accessorKey: 'defautValue',
          header: t('defaultValue', { ns: 'graphtype' }),
        },
      ] as MRT_ColumnDef<IProperty>[],
    []
  );

  const handleCreateEdgeType = () => {
    setEditEdgeType(undefined);
    setModalOpen(true);
  };

  const theme = useTheme();

  return (
    <>
      {!readonly && (
        <ActionContainer mb={2}>
          <Button onClick={handleCreateEdgeType} variant="outlined" startIcon={<AddFilled />}>
            {t('createEdgeType', { ns: 'graphtype' })}
          </Button>
        </ActionContainer>
      )}
      <Box>
        <Table
          columns={getColumns()}
          data={schemaStore?.edgeTypeList.slice() || []}
          renderDetailPanel={({ row }) => {
            const { properties } = row.original;
            return (
              <Table
                columns={getSubColumns(properties.length)}
                data={properties}
                enablePagination={false}
                enableBottomToolbar={false}
                muiTableHeadCellProps={{
                  sx: {
                    height: '35px',
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingLeft: theme.spacing(2),
                  },
                }}
                muiTableBodyCellProps={{
                  sx: {
                    height: '35px',
                    padding: 0,
                    paddingLeft: theme.spacing(2),
                  },
                }}
                muiTableProps={{
                  sx: {
                    backgroundColor: theme.palette.vesoft.bgColor1,
                  },
                }}
                muiTablePaperProps={{
                  sx: {
                    border: 'none',
                    boxShadow: 'none',
                  },
                }}
              />
            );
          }}
        />
      </Box>
      <EdgeTypeConfigModal open={modalOpen} onCancel={() => setModalOpen(false)} edgeTypeItem={editEdgeType} />
    </>
  );
}

export default observer(EdgeTypeTable);
