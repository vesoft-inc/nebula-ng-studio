import { useCallback, useEffect } from 'react';
import { Box, useTheme } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import SchemaTree, { generateTreeNodeKey } from '@studio/components/SchemaTree';
import { TreeNode } from '@studio/components/LazyTree';
import { SchemaItemType } from '@studio/utils/constant';
import { ISchemaTreeRawData } from '@studio/interfaces';
import { encodeUrl, isGuiTarget } from '@studio/utils';
import { useStore } from '@studio/stores';
import CreateGraphModal from '@studio/components/CreateGraphModal';

function Schema() {
  const navigate = useNavigate();
  const params = useParams();
  const theme = useTheme();
  const { pathname } = useLocation();
  const { schemaStore, commonStore } = useStore();
  const { selectedKeys, schemas, updateSelectedKeys, createGraphModalInfo } = schemaStore;

  useEffect(() => {
    if (isGuiTarget) {
      commonStore.getUserInfo();
    }
  }, []);

  const getInitSelectedKeys = useCallback(() => {
    const paths = pathname.split('/');
    let key: string = SchemaItemType.GraphType;
    if (paths[1] === 'schema-manager') {
      const subItemType = paths[2];
      if (subItemType === 'graphtype') {
        const { graphTypeName } = params;
        key = graphTypeName
          ? generateTreeNodeKey(SchemaItemType.GraphTypeDescItem, { graphTypeName })
          : generateTreeNodeKey(SchemaItemType.GraphType, {});
      } else if (subItemType === 'graphs') {
        const { graphName } = params;
        key = graphName
          ? generateTreeNodeKey(SchemaItemType.GraphDescItem, { graphName })
          : generateTreeNodeKey(SchemaItemType.Graph, {});
      }
    }
    return [key];
  }, [pathname]);

  useEffect(() => {
    updateSelectedKeys(getInitSelectedKeys());
  }, [pathname]);

  useEffect(() => {
    initSchemaTreeData();
  }, [schemas.length]);

  const initSchemaTreeData = async () => {
    if (!schemas.length) {
      await schemaStore.getSchemas();
    }
    await Promise.all([schemaStore.updateGraphTypesBySchema(), schemaStore.updateGraphsBySchema()]);
  };

  const handleItemSelected = useCallback((node: TreeNode<ISchemaTreeRawData>) => {
    const { rawData, key } = node;
    const { type } = rawData!;
    updateSelectedKeys([key]);
    switch (type) {
      case SchemaItemType.GraphType:
        navigate('/schema-manager/graphtype');

        break;
      case SchemaItemType.GraphTypeDescItem:
        navigate(`/schema-manager/graphtype/view/${encodeUrl(rawData!.graphType!.graph_type)}`);
        break;
      case SchemaItemType.Graph:
        navigate('/schema-manager/graphs');
        break;
      case SchemaItemType.GraphDescItem:
        navigate(`/schema-manager/graphs/${encodeUrl(rawData!.graph!.graph)}`);
        break;
      default:
        break;
    }
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        background: theme.palette.vesoft.v2.bg1,
      }}
    >
      <SchemaTree showDetail={false} onItemSelected={handleItemSelected} selectedKeys={selectedKeys} />
      <Box
        position="relative"
        padding={theme.spacing(3, 0)}
        flex={1}
        sx={{
          overflow: 'auto',
          background: theme.palette.vesoft.v2.bg2,
        }}
      >
        <Outlet />
      </Box>
      <CreateGraphModal
        open={createGraphModalInfo.visible}
        onCancel={() => {
          schemaStore.updateCreateGraphModalInfo({ visible: false });
        }}
        onOk={() => {
          schemaStore.updateGraphsBySchema();
          navigate('/schema-manager/graphs');
          schemaStore.updateCreateGraphModalInfo({ visible: false });
        }}
        graphTypes={schemaStore.currentSchema?.graphTypes || []}
      />
    </Box>
  );
}

export default observer(Schema);
