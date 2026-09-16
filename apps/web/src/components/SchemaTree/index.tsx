import { observer } from 'mobx-react-lite';
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { getVesoftBorder } from '@studio/utils';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@studio/stores';
import { SchemaItemType } from '@studio/utils/constant';
import LazyTree, { TreeNode } from '../LazyTree';
import useConvertSchemaToTree from './useConvertSchemaToTree';
import SchemaSelector from './SchemaSelector';
import { ISchemaTreeRawData } from '@studio/interfaces';

const SiderItem = styled(Box)`
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: ${getVesoftBorder};
`;

export const PATH_SPLITTER = '-';

export { generateTreeNodeKey } from './useConvertSchemaToTree';

interface ISchemaTreeProps {
  onItemSelected?: (node: TreeNode<ISchemaTreeRawData>) => void;
  selectedKeys?: string[];
  showDetail?: boolean; // if show detail, will show entity and property in graphtype
}

function SchemaTree(props: ISchemaTreeProps) {
  const { showDetail = true } = props;
  const { schemaStore } = useStore();
  const { currentSchema } = schemaStore;
  const [curWidth, setCurWidth] = useState<number>(300);
  const siderItemRef = useRef<HTMLDivElement>(null);
  const position: React.MutableRefObject<Record<string, number>> = useRef({});

  useEffect(() => {
    schemaStore.getSchemas();
    return () => {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
    };
  }, []);

  const handleAsnycLoadData = async (node: TreeNode<ISchemaTreeRawData>) => {
    const { key, rawData } = node;
    const { type } = rawData as { type: SchemaItemType };
    switch (type) {
      case SchemaItemType.GraphType: {
        await schemaStore.updateGraphTypesBySchema();
        break;
      }
      case SchemaItemType.GraphTypeDescItem: {
        if (showDetail) {
          const [, graph_type_name] = key.split(PATH_SPLITTER);
          await schemaStore.updateGraphTypeDetailBySchema(graph_type_name);
        }
        break;
      }
      case SchemaItemType.EntityTypeDescItem: {
        if (showDetail) {
          const [, graph_type_name, entity_type_name] = key.split(PATH_SPLITTER);
          await schemaStore.updateEntityTypeDescsBySchema(graph_type_name, entity_type_name);
        }
        break;
      }
      case SchemaItemType.Graph: {
        await schemaStore.updateGraphsBySchema();
        break;
      }
    }
  };

  const convertSchemaToTree = useConvertSchemaToTree(currentSchema, showDetail);

  const onDrag = (e: MouseEvent) => {
    e.preventDefault();
    const dx = e.pageX - position.current.startX;
    const width = dx + position.current.width;
    setCurWidth(width);
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
  };

  return (
    <SiderItem sx={{ width: curWidth, position: 'relative' }} ref={siderItemRef}>
      <SchemaSelector paperWidth={curWidth} />
      <LazyTree<ISchemaTreeRawData>
        treeData={convertSchemaToTree(currentSchema)}
        onItemSelect={props.onItemSelected}
        selectedKeys={props.selectedKeys}
        asynLoadData={handleAsnycLoadData}
      />
    </SiderItem>
  );
}

export default observer(SchemaTree);
