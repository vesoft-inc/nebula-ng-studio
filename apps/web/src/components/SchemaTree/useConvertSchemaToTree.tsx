import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import {
  AddFilled,
  ArrowBackFilled,
  ArrowForwardFilled,
  ChartTimelineVariant,
  DotsHexagon,
  EdgeType,
  Minus,
  SpaceDashboardFilled,
} from '@vesoft-inc/icons';
import { DescEdgeTypeResult, DescNodeTypeResult, EdgeDirectionType, GraphEntityType } from '@vesoft-inc/utils';

import { SchemaItemType } from '@studio/utils/constant';
import { extractEdgeByEdgeTypeName, getLabelColor } from '@studio/utils';
import { useStore } from '@studio/stores';
import { GraphTypeElement, NebulaSchema } from '@studio/interfaces';
import { useTranslation } from 'react-i18next';

export const PATH_SPLITTER = '-';

export const generateTreeNodeKey = (
  schemaType: SchemaItemType,
  data: Partial<{
    graphTypeName: string;
    propertyName: string;
    entityTypeName: string;
    graphName: string;
  }>
) => {
  switch (schemaType) {
    case SchemaItemType.GraphType:
      return [SchemaItemType.GraphType].join(PATH_SPLITTER);
    case SchemaItemType.GraphTypeDescItem:
      return [SchemaItemType.GraphTypeDescItem, data.graphTypeName!].join(PATH_SPLITTER);
    case SchemaItemType.PropertyDescItem:
      return [SchemaItemType.PropertyDescItem, data.graphTypeName!, data.entityTypeName!, data.propertyName!].join(
        PATH_SPLITTER
      );
    case SchemaItemType.EntityTypeDescItem:
      return [SchemaItemType.EntityTypeDescItem, data.graphTypeName!, data.entityTypeName!].join(PATH_SPLITTER);
    case SchemaItemType.Graph:
      return [SchemaItemType.Graph, 'graph'].join(PATH_SPLITTER);
    case SchemaItemType.GraphDescItem:
      return [SchemaItemType.GraphDescItem, data.graphName!].join(PATH_SPLITTER);
    default:
      return '';
  }
};

export default function useConvertSchemaToTree(schema: NebulaSchema, showDetail: boolean) {
  const theme = useTheme();
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
  const { schemaStore } = useStore();
  const handleCreateGraphType = () => () => {
    navigate('/schema-manager/graphtype/create');
  };

  const renderEdgeInfo = (entity: GraphTypeElement) => {
    if (!(entity.entity_type === GraphEntityType.Edge)) return;
    const info = extractEdgeByEdgeTypeName(entity.type_pattern!);
    if (!info) return;
    const { fromNodeName, dstNodeName, direction } = info;
    return (
      <Stack direction="row" spacing={1}>
        <DotsHexagon />
        <Typography>{fromNodeName}</Typography>
        {direction === EdgeDirectionType.Forward && <ArrowForwardFilled />}
        {direction === EdgeDirectionType.Backward && <ArrowBackFilled />}
        {direction === EdgeDirectionType.Undirected && <Minus />}
        <Typography>{dstNodeName}</Typography>
      </Stack>
    );
  };

  const renderSubTitle = (entity: GraphTypeElement) => {
    const labels = entity.labels.map((label, index) => {
      const [color, backgroundColor] = getLabelColor(index, theme);
      return (
        <Chip
          key={label}
          sx={{
            borderColor: color,
            backgroundColor,
            color,
            '&:not(:first-of-type)': { ml: 1 },
            mb: 0.5,
            mt: 0.5,
            height: 24,
          }}
          label={label}
          variant="outlined"
          size="small"
        />
      );
    });
    if (entity.entity_type === GraphEntityType.Node) {
      return labels;
    } else if (entity.entity_type === GraphEntityType.Edge) {
      return (
        <Box display="flex" flexDirection="column">
          <Box>{labels}</Box>
          {renderEdgeInfo(entity)}
        </Box>
      );
    }
    return '';
  };

  const renderProperty = (property: DescNodeTypeResult | DescEdgeTypeResult) => {
    if (property.type === GraphEntityType.Node) {
      return (
        <Box display="flex" alignItems="center">
          <Box color={(theme) => theme.palette.vesoft.textColor3} fontWeight={400}>
            {property.property_name}
          </Box>
          <Chip
            sx={{
              ml: 1,
              height: 20,
              fontSize: 12,
              fontWeight: 400,
              color: (theme) => theme.palette.vesoft.themeColor8,
            }}
            label={property.data_type}
          />
          {(property as DescNodeTypeResult).primary_key === 'Y' && (
            <Chip
              sx={{ ml: 1, height: 20, fontSize: 12, fontWeight: 400, color: (theme) => theme.palette.vesoft.status3 }}
              label={'PRIMARY'}
            />
          )}
        </Box>
      );
    }
    if (property.type === GraphEntityType.Edge) {
      return (
        <Box display="flex" alignItems="center">
          <Box>{property.property_name}</Box>
          <Chip
            sx={{
              ml: 1,
              height: 20,
              fontSize: 12,
              fontWeight: 400,
              color: (theme) => theme.palette.vesoft.themeColor8,
            }}
            label={property.data_type}
          />
        </Box>
      );
    }
    return;
  };

  const convertSchemasToTree = useCallback(
    (schema: NebulaSchema) => {
      return [
        {
          title: t('graphtype', { ns: 'common' }),
          icon: <SpaceDashboardFilled sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }} />,
          key: generateTreeNodeKey(SchemaItemType.GraphType, {}),
          rawData: {
            type: SchemaItemType.GraphType,
          },
          rightPart: showDetail ? undefined : (
            <IconButton onClick={handleCreateGraphType()}>
              <AddFilled sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }} />
            </IconButton>
          ),
          children: schema.graphTypes.map((graphType) => ({
            title: (
              <Typography color="text.primary" maxWidth={210} overflow="hidden" textOverflow="ellipsis">
                <Tooltip title={graphType.graph_type}>
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      wordBreak: 'keep-all',
                      '&:hover': { color: theme.palette.vesoft.v2.primary3 },
                    }}
                  >
                    {graphType.graph_type}
                  </Box>
                </Tooltip>
              </Typography>
            ),
            icon: <SpaceDashboardFilled sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }} />,
            key: generateTreeNodeKey(SchemaItemType.GraphTypeDescItem, {
              graphTypeName: graphType.graph_type,
            }),
            rawData: { graphType, type: SchemaItemType.GraphTypeDescItem },
            children: showDetail
              ? (graphType.entities || []).map((entity) => ({
                  title: entity.type_name,
                  icon: entity.entity_type === GraphEntityType.Node ? <DotsHexagon /> : <EdgeType />,
                  key: generateTreeNodeKey(SchemaItemType.EntityTypeDescItem, {
                    graphTypeName: graphType.graph_type,
                    entityTypeName: entity.type_name,
                  }),
                  subTitle: renderSubTitle(entity),
                  children: (entity.propertyInfos || []).map((property) => ({
                    title: renderProperty(property),
                    key: generateTreeNodeKey(SchemaItemType.PropertyDescItem, {
                      graphTypeName: graphType.graph_type,
                      entityTypeName: entity.type_name,
                      propertyName: property.property_name,
                    }),
                    rawData: {
                      graphType,
                      entity,
                      property,
                      type: SchemaItemType.PropertyDescItem,
                    },
                  })),
                  rawData: {
                    graphType: {
                      ...graphType,
                      entities: [],
                    },
                    entity: {
                      ...entity,
                      propertyInfos: [],
                    },
                    type: SchemaItemType.EntityTypeDescItem,
                  },
                }))
              : undefined,
          })),
        },
        {
          title: t('graph', { ns: 'common' }),
          key: generateTreeNodeKey(SchemaItemType.Graph, {}),
          icon: <ChartTimelineVariant sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }} />,
          rawData: { type: SchemaItemType.Graph },
          rightPart: showDetail ? undefined : (
            <IconButton
              onClick={() => {
                schemaStore.updateCreateGraphModalInfo({ visible: true });
              }}
            >
              <AddFilled sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }} />
            </IconButton>
          ),
          children: schema.graphs.map((graph) => ({
            title: (
              <Typography color="text.primary" maxWidth={210} overflow="hidden" textOverflow="ellipsis">
                <Tooltip title={graph.graph}>
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      wordBreak: 'keep-all',
                      '&:hover': { color: theme.palette.vesoft.v2.primary3 },
                    }}
                  >
                    {graph.graph}
                  </Box>
                </Tooltip>
              </Typography>
            ),
            icon: <ChartTimelineVariant sx={{ color: (theme) => theme.palette.vesoft.v2.text3 }} />,
            key: generateTreeNodeKey(SchemaItemType.GraphDescItem, {
              graphName: graph.graph,
            }),
            rawData: {
              graph,
              type: SchemaItemType.GraphDescItem,
            },
          })),
        },
      ];
    },
    [schema]
  );

  return convertSchemasToTree;
}
