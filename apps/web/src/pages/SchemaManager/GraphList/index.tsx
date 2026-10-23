import { useEffect, useState } from 'react';
import { Typography, useTheme, IconButton, Box, Container, List, Grid, Button, PopoverProps } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dropdown, ListCard } from '@vesoft-inc/ui-components';
import { DeleteOutline, MoreHorizFilled, AddFilled, SpaceDashboardFilled } from '@vesoft-inc/icons';

import { schemaStore } from '@studio/stores/session';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import CollapseItem from '@studio/components/CollapseItem';
import { GraphItem, GraphType } from '@studio/interfaces';
import { encodeUrl } from '@studio/utils';
import { generateTreeNodeKey } from '@studio/components/SchemaTree';
import { SchemaItemType } from '@studio/utils/constant';
import EmptyGraph from '@studio/components/EmptyGraph';
import emptyGraphImg from '@studio/images/empty-graph.svg?url';
import emptyGraphDarkImg from '@studio/images/empty-graph-dark.svg?url';
import TitleEllipsis from '@studio/components/TitleEllipsis';
import DeleteGraphModal from '@studio/components/DeleteGraphModal';

function GraphList() {
  const theme = useTheme();
  const { currentSchema } = schemaStore;
  const isDarkMode = themeStore.mode === 'dark';
  const { t } = useTranslation('common');
  const [graphTypes, setGraphTypes] = useState<GraphType[]>([]);
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const navigate = useNavigate();
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleteModalGraphName, setDeleteModalGraphName] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchGraphTypes = async () => {
    const graphtypes = await schemaStore.getGraphTypes();
    return graphtypes;
    // setGraphTypes(graphtypes);
  };

  const fetchGraphs = async () => {
    const res = await schemaStore.updateGraphsBySchema();
    return res;
  };

  const fetchData = async () => {
    setDataLoaded(false);
    Promise.all([fetchGraphTypes(), fetchGraphs()])
      .then(([graphTypes, _]) => {
        setGraphTypes(graphTypes);
      })
      .finally(() => {
        setDataLoaded(true);
      });
  };

  const handleCreateGraph = () => {
    schemaStore.updateCreateGraphModalInfo({
      visible: true,
    });
  };

  const handleDeleteGraph = async () => {
    if (deleteModalGraphName) {
      const res = await schemaStore.dropGraph(deleteModalGraphName);
      if (res.code === 0) {
        await fetchGraphs();
      }
      setDeleteModalOpen(false);
      setDeleteModalGraphName(null);
    }
  };

  const graphMap = graphTypes.map((graphType) => ({
    graphTypeName: graphType.graph_type,
    graphs: currentSchema.graphs.filter((graph) => graph.graph_type === graphType.graph_type) || [],
  }));

  const handleViewGraphInfo = (graphItem: GraphItem) => () => {
    const key = generateTreeNodeKey(SchemaItemType.GraphDescItem, {
      graphName: graphItem.graph,
    });
    schemaStore.updateSelectedKeys([key]);
    navigate(`${encodeUrl(graphItem.graph)}`);
  };

  if (dataLoaded && (!graphMap?.length || graphMap.every(({ graphs }) => !graphs.length))) {
    return (
      <EmptyGraph
        title={t('createGraph', { ns: 'graphtype' })}
        description={[t('emptyGraphDes1', { ns: 'graphtype' }), t('emptyGraphDes2', { ns: 'graphtype' })]}
        slotProps={{
          emptyImgSrc: isDarkMode ? emptyGraphDarkImg : emptyGraphImg,
        }}
        buttonProps={{
          okText: t('create', { ns: 'common' }),
          handleOk: handleCreateGraph,
        }}
      />
    );
  }

  return (
    <Container maxWidth={false}>
      <Box display="flex" justifyContent="space-between">
        <Typography
          variant="h3"
          fontSize={20}
          fontWeight={500}
          lineHeight={'36px'}
          color={theme.palette.vesoft.textColor1}
        >
          {`${t('graphList', { ns: 'route' })} (${currentSchema?.graphs.length || 0})`}
        </Typography>
        <Box>
          {/* <Button onClick={goToSketchList} variant="outlined" color="primary" sx={{ marginRight: 2 }}>
            {t('sketchBtn', { ns: 'graphtype', number: sketchNum })}
          </Button> */}
          <Button onClick={handleCreateGraph} startIcon={<AddFilled />} variant="contained" color="primary">
            {t('createGraph')}
          </Button>
        </Box>
      </Box>
      <Box mt={2}>
        <List sx={{ width: '100%', paddingTop: 0 }} component="nav">
          {graphMap.map(({ graphTypeName, graphs }, index: number) => (
            <CollapseItem
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', fontSize: 16, mb: theme.spacing(0.5) }}>
                  <SpaceDashboardFilled sx={{ mr: theme.spacing(0.5), color: theme.palette.vesoft.v2.text3 }} />
                  {`${graphTypeName}(${graphs.length})`}
                </Box>
              }
              key={index}
              defaultOpen
              slots={{
                subItemSx: {
                  pl: 0,
                },
                container: {
                  sx: {
                    mb: 2,
                  },
                },
              }}
            >
              <Grid container spacing={3}>
                {graphs.map((graphItem, idx) => (
                  <Grid size={{ xl: 4, xs: 6 }} key={`schema_graphList_${idx}`}>
                    <ListCard
                      // title={graphItem.graph}
                      title={
                        <TitleEllipsis
                          title={graphItem.graph}
                          maxWidth={320}
                          slotProps={{
                            fontSize: 16,
                            fontWeight: 500,
                            color: theme.palette.vesoft.v2.text2,
                          }}
                        />
                      }
                      onClick={handleViewGraphInfo(graphItem)}
                      infos={[
                        {
                          label: t('index'),
                          value: graphItem.index_cnt,
                        },
                        {
                          label: t('owner'),
                          value: <TitleEllipsis title={graphItem.owner} maxWidth={200} />,
                        },
                      ]}
                      actions={
                        // <Box position="absolute" right={20} bottom={15}>
                        <Box>
                          <Dropdown
                            items={[
                              {
                                icon: <DeleteOutline color="error" />,
                                label: <Typography color="error">{t('delete', { ns: 'graphtype' })}</Typography>,
                                key: 'delete',
                                onClick: () => {
                                  setDeleteModalGraphName(graphItem.graph);
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
                          </Dropdown>
                        </Box>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            </CollapseItem>
          ))}
        </List>
      </Box>
      <DeleteGraphModal open={deleteModalOpen} onCancel={() => setDeleteModalOpen(false)} onOk={handleDeleteGraph} />
    </Container>
  );
}

export default observer(GraphList);
