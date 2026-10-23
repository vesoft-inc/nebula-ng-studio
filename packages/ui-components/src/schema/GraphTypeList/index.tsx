import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Typography, useTheme, Button, Box, Container, Grid, PopoverProps, IconButton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  SpaceDashboardFilled,
  AddFilled,
  DeleteOutline,
  MoreHorizFilled,
  RemoveRedeyeFilled,
  EditFilled,
} from '@vesoft-inc/icons';
import { Dropdown, ListCard } from '../../shared/index';

import { useSchema } from '../context';
import type { SketchServices } from '../../schema-editor/services';
import { GraphType } from '../types';
import { generateTreeNodeKey } from '../SchemaTree/index';
import { SchemaItemType } from '../../shared/constants';
import ViewDDLModal from '../ViewDDLDialog/index';
import EmptyGraph from '../../shared/EmptyGraph/index';
import emptyGraphTypeImg from '../../assets/images/empty-graph-type.svg?url';
import emptyGraphTypeDarkImg from '../../assets/images/empty-graph-type-dark.svg?url';
import TitleEllipsis from '../../shared/TitleEllipsis/index';
import DeleteGraphTypeModal from '../DeleteGraphTypeDialog/index';
import PageLoading from '../../shared/PageLoading/index';

export interface GraphTypeListProps {
  sketches?: Pick<SketchServices, 'list'>;
  onCreate?: () => void;
  onView?: (name: string) => void;
  onEdit?: (name: string) => void;
  onSketches?: () => void;
}

function GraphTypeList({ onCreate, onView, onEdit, onSketches, sketches }: GraphTypeListProps) {
  const schemaStore = useSchema();
  const theme = useTheme();
  const { currentSchema, importDemoDataset } = schemaStore;
  const isDarkMode = theme.palette.mode === 'dark';
  const [initialLoading, setInitialLoading] = useState(true);
  const [sketchNum, setSketchNum] = useState<number>(0);
  const [ddlModalOpen, setDDLModalOpen] = useState<boolean>(false);
  const [importDataLoading, setImportDataLoading] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleteModalGraphType, setDeleteModalGraphType] = useState<string | null>(null);

  const curDDL = useRef<string>('');

  const { t } = useTranslation(['graphtype', 'common']);

  useEffect(() => {
    let mounted = true;

    initGraphTypes().finally(() => {
      if (mounted) {
        setInitialLoading(false);
      }
    });
    fetchSketchTotalNum();

    return () => {
      mounted = false;
    };
  }, []);

  const fetchSketchTotalNum = () => {
    sketches?.list({ page: 1, pageSize: 1 }).then((res) => {
      if (res.code === 0) {
        setSketchNum(res.data!.total);
      }
    });
  };

  const initGraphTypes = async () => {
    await schemaStore.updateGraphTypesBySchema();
  };

  const goToSketchList = () => {
    onSketches?.();
  };

  const handleCreateGraphType = () => {
    onCreate?.();
  };

  const handleUseDataset = async () => {
    try {
      setImportDataLoading(true);
      const res = await importDemoDataset('movie');
      if (res.code === 0) {
        onView?.('movie_type');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setImportDataLoading(false);
    }
  };

  const navigateToGraphType = (graphType: GraphType, type: 'view' | 'edit') => () => {
    const key = generateTreeNodeKey(SchemaItemType.GraphTypeDescItem, {
      graphTypeName: graphType.graph_type,
    });
    schemaStore.updateSelectedKeys([key]);
    (type === 'view' ? onView : onEdit)?.(graphType.graph_type);
  };

  const handleDeleteGraphType = async () => {
    if (deleteModalGraphType) {
      const res = await schemaStore.dropGraphType(deleteModalGraphType);
      if (res.code === 0) {
        await initGraphTypes();
      }
      setDeleteModalOpen(false);
      setDeleteModalGraphType(null);
    }
  };

  const renderListCardActions = (graphType: GraphType) => {
    return [
      // <Button onClick={navigateToGraphType(graphType, 'view')} key={1} variant="outlined" sx={{ mr: 1 }}>
      //   {t('viewGraphType', { ns: 'graphtype' })}
      // </Button>,
      <Dropdown
        key={2}
        items={[
          {
            icon: <RemoveRedeyeFilled color="primary" />,
            label: <Typography color="primary">{t('viewDDL', { ns: 'graphtype' })}</Typography>,
            key: 'view-ddl ',
            onClick: async () => {
              const ddl = await schemaStore.getCreateGraphTypeDDL(graphType.graph_type);
              if (ddl) {
                curDDL.current = ddl;
                setDDLModalOpen(true);
              }
            },
          },
          {
            icon: <DeleteOutline color="error" />,
            label: <Typography color="error">{t('delete', { ns: 'graphtype' })}</Typography>,
            key: 'delete',
            onClick: () => {
              setDeleteModalGraphType(graphType.graph_type);
              setDeleteModalOpen(true);
            },
          },
        ]}
        slotProps={{
          popover: {
            onMouseDown: (e) => e.stopPropagation(),
            onClick: (e) => {
              e.stopPropagation();
              e.preventDefault();
            },
          } as PopoverProps,
        }}
      >
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <MoreHorizFilled
            fontSize="medium"
            sx={{
              color: theme.palette.vesoft.v2.text2,
            }}
          />
        </IconButton>
      </Dropdown>,
    ];
  };

  if (initialLoading) {
    return <PageLoading />;
  }

  if (currentSchema?.graphTypes?.length <= 0) {
    return (
      <Box width="100%" height={300} mt={10}>
        <EmptyGraph
          title={t('createGraphType', { ns: 'graphtype' })}
          description={[t('emptyGraphTypeDes1', { ns: 'graphtype' }), t('emptyGraphTypeDes2', { ns: 'graphtype' })]}
          slotProps={{
            emptyImgSrc: isDarkMode ? emptyGraphTypeDarkImg : emptyGraphTypeImg,
          }}
          buttonProps={{
            okText: t('create', { ns: 'common' }),
            handleOk: handleCreateGraphType,
            cancelText: schemaStore.services.importDataset ? t('useDataset', { ns: 'graphtype' }) : undefined,
            handleCancel: handleUseDataset,
            loading: importDataLoading,
          }}
        />
      </Box>
    );
  }

  return (
    <Container maxWidth={false}>
      <Box display="flex" justifyContent="space-between" paddingBottom={theme.spacing(1)}>
        <Typography
          variant="h3"
          fontSize={20}
          fontWeight={500}
          lineHeight={'36px'}
          color={theme.palette.vesoft.textColor1}
        >
          {`${t('graphTypeList', { ns: 'graphtype' })} (${currentSchema?.graphTypes?.length || 0})`}
        </Typography>
        <Box>
          {sketches && (
            <Button onClick={goToSketchList} variant="outlined" color="primary" sx={{ marginRight: 2 }}>
              {t('sketchBtn', { ns: 'graphtype', number: sketchNum })}
            </Button>
          )}
          <Button onClick={handleCreateGraphType} startIcon={<AddFilled />} variant="contained" color="primary">
            {t('createGraphType', { ns: 'graphtype' })}
          </Button>
        </Box>
      </Box>
      <Box width="100%">
        <Grid container spacing={3} mt={theme.spacing(0.5)}>
          {currentSchema?.graphTypes?.length > 0 &&
            (currentSchema?.graphTypes || []).map((graphType, index) => (
              <Grid size={{ xl: 4, xs: 6 }} key={`schema_graphTypes_${index}`}>
                <ListCard
                  title={
                    <TitleEllipsis
                      title={graphType.graph_type}
                      maxWidth={400}
                      slotProps={{
                        sx: {
                          fontWeight: 500,
                          fontSize: 16,
                        },
                      }}
                    />
                  }
                  icon={<SpaceDashboardFilled sx={{ mr: theme.spacing(1) }} fontSize="small" />}
                  onClick={navigateToGraphType(graphType, 'view')}
                  infos={[
                    {
                      label: `${t('common:owner')}`,
                      value: <TitleEllipsis title={graphType.owner} maxWidth={200} />,
                    },
                  ]}
                  actions={
                    renderListCardActions(graphType) || (
                      <Button size="small" startIcon={<EditFilled />} variant="outlined">
                        {t('manage', { ns: 'common' })}
                      </Button>
                    )
                  }
                />
              </Grid>
            ))}
        </Grid>

        {/* {currentSchema?.graphTypes?.length > 0 &&
          (currentSchema?.graphTypes || []).map((graphType, index) => (
            <ListCard
              key={index}
              icon={<SpaceDashboardFilled fontSize="medium" />}
              name={graphType.graph_type}
              infos={[
                {
                  label: `${t('common:owner')}:`,
                  value: <TitleEllipsis title={graphType.owner} maxWidth={200} />,
                },
                // {
                //   label: 'Schema:',
                //   value: currentSchema?.path,
                // },
              ]}
              sx={{ marginTop: '20px' }}
              actions={renderListCardActions(graphType)}
            />
          ))} */}
      </Box>
      <ViewDDLModal
        open={ddlModalOpen}
        ddl={curDDL.current}
        onCancel={() => {
          setDDLModalOpen(false);
        }}
      />
      <DeleteGraphTypeModal
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDeleteGraphType}
      />
    </Container>
  );
}

export default observer(GraphTypeList);
