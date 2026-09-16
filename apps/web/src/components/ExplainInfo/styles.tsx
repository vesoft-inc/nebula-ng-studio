import { Box, styled, Typography } from '@mui/material';

export enum NodeLevelType {
  Level1 = 'level1',
  Level2 = 'level2',
  Level3 = 'level3',
  Level4 = 'level4',
  Level5 = 'level5',
}

const baseNodeStyles = {
  border: '1px solid',
  borderRadius: '4px',
  width: 300,
  padding: '8px',
  fontSize: 14,
  boxShadow: 'none',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderTopWidth: '6px',
  cursor: 'pointer',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
};

export const NodeHeightMap = {
  [NodeLevelType.Level1]: 30,
  [NodeLevelType.Level2]: 40,
  [NodeLevelType.Level3]: 50,
  [NodeLevelType.Level4]: 60,
  [NodeLevelType.Level5]: 70,
};

// timeMs ~ [0%-10%]
export const Level1NodeContainer = styled(Box)(({ theme }) => ({
  ...baseNodeStyles,
  height: NodeHeightMap[NodeLevelType.Level1],
  borderColor: theme.palette.vesoft.v2.plannode1,
  borderTopWidth: '1px',
  backgroundColor: theme.palette.vesoft.v2.bg5,
}));

// timeMs ~ [10%-20%]
export const Level2NodeContainer = styled(Box)(({ theme }) => ({
  ...baseNodeStyles,
  height: NodeHeightMap[NodeLevelType.Level2],
  borderColor: theme.palette.vesoft.v2.plannode2,
  backgroundColor: theme.palette.vesoft.v2.bg1,
}));

// timeMs ~ [20%-40%]
export const Level3NodeContainer = styled(Box)(({ theme }) => ({
  ...baseNodeStyles,
  height: NodeHeightMap[NodeLevelType.Level3],
  borderColor: theme.palette.vesoft.v2.plannode3,
  backgroundColor: theme.palette.vesoft.v2.bg1,
}));

// timeMs ~ [40%-60%]
export const Level4NodeContainer = styled(Box)(({ theme }) => ({
  ...baseNodeStyles,
  height: NodeHeightMap[NodeLevelType.Level4],
  borderColor: theme.palette.vesoft.v2.plannode4,
  backgroundColor: theme.palette.vesoft.v2.bg1,
}));

// timeMs ~ [60%-100%]
export const Level5NodeContainer = styled(Box)(({ theme }) => ({
  ...baseNodeStyles,
  height: NodeHeightMap[NodeLevelType.Level5],
  borderColor: theme.palette.vesoft.v2.plannode5,
  backgroundColor: theme.palette.vesoft.v2.bg1,
}));

export const PlanNodeTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: 14,
  // minidth: 140,
  flex: 1,
  color: theme.palette.vesoft.v2.text1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  margin: 0,
  marginRight: 1,
}));

export const SpHeader = styled('span')(({ theme }) => ({
  fontWeight: 'normal',
  marginRight: '4px',
  color: theme.palette.vesoft.v2.primary3,
}));

export const ContainerMap = {
  [NodeLevelType.Level1]: Level1NodeContainer,
  [NodeLevelType.Level2]: Level2NodeContainer,
  [NodeLevelType.Level3]: Level3NodeContainer,
  [NodeLevelType.Level4]: Level4NodeContainer,
  [NodeLevelType.Level5]: Level5NodeContainer,
};

export const ExplainInfoContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  backgroundColor: `${theme.palette.vesoft.v2.bg5}`,
  overflow: 'hidden',
  '& .react-flow__controls': {
    '& .react-flow__controls-button': {
      width: 24,
      height: 24,
      border: `1px solid ${theme.palette.vesoft.v2.border1}`,
      borderRadius: '4px',
      '&:not(:last-child)': {
        marginBottom: '4px',
      },
    },
    // 为自定义的MiniMap切换按钮添加样式
    '& > div': {
      marginTop: '8px',
    },
  },
  '& .react-flow__node-group': {
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
    padding: 0,
    '&.selected': {
      border: `2px solid ${theme.palette.vesoft.v2.primary2}`,
    },
  },
  // 隐藏所有 Handle（连接点）
  '& .react-flow__handle': {
    opacity: 0,
    pointerEvents: 'none',
  },
  // MiniMap 样式
  '& .react-flow__minimap': {
    width: 280,
    height: 220,
    margin: 0,
    // 位置调整为左下角，为controls留出空间
    bottom: '14px !important',
    left: '28px !important',
    cursor: 'grab',
    position: 'relative', // 为子元素定位提供参考
    '&:active': {
      cursor: 'grabbing',
    },
    // 确保SVG填满整个容器
    '& .react-flow__minimap-svg': {
      width: '280px !important',
      height: '220px !important',
    },

    '& .react-flow__minimap-mask': {
      fill: 'transparent !important',
      stroke: `${theme.palette.vesoft.v2.border1}`,
      strokeWidth: '30 !important',
    },
    '& .react-flow__minimap-node': {
      fill: theme.palette.vesoft.v2.error1,
      stroke: theme.palette.vesoft.v2.border1,
      strokeWidth: 1.5,
      opacity: 1,
    },
    // Level 1 节点样式 (0%-10% 时间消耗)
    '& .minimap-level1-node': {
      fill: theme.palette.vesoft.v2.plannode1,
      stroke: theme.palette.vesoft.v2.plannode1,
      strokeWidth: 2,
      opacity: 1,
    },
    // Level 2 节点样式 (10%-20% 时间消耗)
    '& .minimap-level2-node': {
      fill: theme.palette.vesoft.v2.plannode2,
      stroke: theme.palette.vesoft.v2.plannode2,
      strokeWidth: 2,
      opacity: 1,
    },
    // Level 3 节点样式 (20%-40% 时间消耗)
    '& .minimap-level3-node': {
      fill: theme.palette.vesoft.v2.plannode3,
      stroke: theme.palette.vesoft.v2.plannode3,
      strokeWidth: 2,
      opacity: 1,
    },
    // Level 4 节点样式 (40%-60% 时间消耗)
    '& .minimap-level4-node': {
      fill: theme.palette.vesoft.v2.plannode4,
      stroke: theme.palette.vesoft.v2.plannode4,
      strokeWidth: 2,
      opacity: 1,
    },
    // Level 5 节点样式 (60%-100% 时间消耗)
    '& .minimap-level5-node': {
      fill: theme.palette.vesoft.v2.plannode5,
      stroke: theme.palette.vesoft.v2.plannode5,
      strokeWidth: 2,
      opacity: 1,
    },
    // 组节点样式
    '& .minimap-group-node': {
      fill: `${theme.palette.vesoft.v2.border1} !important`,
      stroke: `${theme.palette.vesoft.v2.border1}88`,
      strokeWidth: 1.5,
      strokeDasharray: '3,3',
      opacity: 0.7,
    },
    // 默认节点样式
    '& .minimap-default-node': {
      fill: theme.palette.vesoft.v2.bg4,
      stroke: theme.palette.vesoft.v2.border1,
      strokeWidth: 1.5,
      opacity: 1,
    },
  },
}));
