import { Box, List, SxProps, Theme } from '@mui/material';
import React from 'react';
import CollapseItem from '../CollapseItem/index';
import SubItem from '../CollapseItem/SubItem';

export interface TreeNode<T> {
  icon?: React.ReactNode;
  title: string | React.ReactNode;
  key: string;
  children?: TreeNode<T>[];
  disabled?: boolean;
  subTitle?: React.ReactNode;
  rawData?: T;
  rightPart?: React.ReactNode;
}

interface LazyTreeProps<T> {
  treeData: TreeNode<T>[];
  onItemSelect?: (node: TreeNode<T>) => void;
  mulitSelect?: boolean;
  asynLoadData: (node: TreeNode<T>) => Promise<void>;
  selectedKeys?: string[];
}

const subItemSx: SxProps<Theme> = {
  '&:hover': {
    cursor: 'pointer',
    backgroundColor: (theme) => theme.palette.vesoft.v2.bg3,
    color: (theme) => theme.palette.vesoft.themeColor1,
  },
  // borderBottom: (theme) => `1px solid ${theme.palette.vesoft.textColor5}`,
};

function LazyTree<T>(props: LazyTreeProps<T>) {
  const { treeData, asynLoadData, onItemSelect, selectedKeys = [], mulitSelect } = props;

  const handleAsyncLoadData = (node: TreeNode<T>) => {
    if (node.children?.length) return () => {};
    return async () => {
      await asynLoadData(node);
    };
  };

  const [curSelectedKeys, setCurSelectedKeys] = React.useState<string[]>(selectedKeys);

  const handleItemClick = (node: TreeNode<T>) => () => {
    if (mulitSelect) {
      if (curSelectedKeys.includes(node.key)) {
        setCurSelectedKeys(curSelectedKeys.filter((key) => key !== node.key));
      } else {
        setCurSelectedKeys(curSelectedKeys.concat(node.key));
      }
    } else {
      setCurSelectedKeys([node.key]);
    }
    onItemSelect?.(node);
  };

  const renderTreeData = () => {
    const level = 0;
    function dfs(treeNodes: TreeNode<T>[], level: number) {
      return treeNodes.map((node) => {
        if (node.children) {
          return (
            <CollapseItem
              key={node.key}
              level={level}
              icon={node.icon}
              onToggle={handleAsyncLoadData(node)}
              onClick={handleItemClick(node)}
              title={node.title}
              selected={selectedKeys.includes(node.key)}
              defaultOpen={node.children.length > 0}
              rightPart={node.rightPart}
              slots={{
                subItemSx,
              }}
            >
              {node.subTitle && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: (theme) => theme.spacing(0, level * 1 + 4),
                    backgroundColor: (theme) => theme.palette.vesoft.bgColor1,
                  }}
                >
                  {node.subTitle}
                </Box>
              )}
              {dfs(node.children, level + 1)}
            </CollapseItem>
          );
        }
        return (
          <SubItem
            onClick={handleItemClick(node)}
            key={node.key}
            icon={node.icon}
            title={node.title}
            selected={selectedKeys.includes(node.key)}
            level={level + 3}
            sx={subItemSx}
          />
        );
      });
    }
    return dfs(treeData, level);
  };

  return (
    <List sx={{ width: '100%', overflowY: 'auto' }} component="nav">
      {renderTreeData()}
    </List>
  );
}

export default LazyTree;
