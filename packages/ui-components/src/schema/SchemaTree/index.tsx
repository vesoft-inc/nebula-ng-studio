import { observer } from 'mobx-react-lite';
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { getVesoftBorder } from '../../shared/utilities';
import { useEffect, useRef, useState } from 'react';
import LazyTree, { TreeNode } from '../../shared/LazyTree/index';
import useConvertSchemaToTree from './useConvertSchemaToTree';
import SchemaSelector, { type SchemaSelectorProps } from './SchemaSelector';
import { ISchemaTreeRawData, NebulaSchema } from '../types';

const SiderItem = styled(Box)`
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: ${getVesoftBorder};
`;

export const PATH_SPLITTER = '-';

export { generateTreeNodeKey } from './useConvertSchemaToTree';

export interface SchemaTreeProps {
  schema: NebulaSchema;
  onItemSelected?: (node: TreeNode<ISchemaTreeRawData>) => void;
  selectedKeys?: string[];
  showDetail?: boolean; // if show detail, will show entity and property in graphtype
  onReady?: () => void;
  onLoadNode: (node: TreeNode<ISchemaTreeRawData>) => Promise<void>;
  onCreateGraphType?: () => void;
  onCreateGraph?: () => void;
  selector: Omit<SchemaSelectorProps, 'paperWidth'>;
}

function SchemaTree(props: SchemaTreeProps) {
  const { schema, showDetail = true, onReady, onLoadNode, onCreateGraphType, onCreateGraph, selector } = props;
  const [curWidth, setCurWidth] = useState<number>(300);
  const siderItemRef = useRef<HTMLDivElement>(null);
  const position: React.MutableRefObject<Record<string, number>> = useRef({});

  useEffect(() => {
    onReady?.();
    return () => {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
    };
  }, []);

  const convertSchemaToTree = useConvertSchemaToTree(schema, showDetail, {
    onCreateGraphType,
    onCreateGraph,
  });

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
      <SchemaSelector paperWidth={curWidth} {...selector} />
      <LazyTree<ISchemaTreeRawData>
        treeData={convertSchemaToTree(schema)}
        onItemSelect={props.onItemSelected}
        selectedKeys={props.selectedKeys}
        asynLoadData={onLoadNode}
      />
    </SiderItem>
  );
}

export default observer(SchemaTree);
