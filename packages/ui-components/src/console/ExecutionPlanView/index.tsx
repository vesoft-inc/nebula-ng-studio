import { Box, useTheme, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { MonitorDashboard, AddFilled, Minus } from '@vesoft-inc/icons';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeMouseHandler,
  MiniMap,
  useReactFlow,
  useViewport,
  Node,
} from '@xyflow/react';
import '../../styles.css';
import { GQLResultPlanInfo, GQLResultSummary } from '@vesoft-inc/utils';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BaseNode from './PlanNode';
import { usePlanData } from './usePlanData';
import { ExplainInfoContainer, NodeLevelType } from './styles';
import PlanEdge from './PlanEdge';
import PlanNodeDrawer from './PlanNodeDrawer/index';

interface ExplainInfoProps {
  summary: GQLResultSummary;
}

const EmptyContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.vesoft.textAssistColor5,
  fontSize: '14px',
}));

const MiniMapToggleButton = styled(IconButton)(({ theme }) => ({
  width: 24,
  height: 24,
  backgroundColor: theme.palette.vesoft.v2.bg1,
  border: `1px solid ${theme.palette.vesoft.v2.border1}`,
  borderRadius: '4px',
  marginBottom: '8px',
  '&:hover': {
    backgroundColor: theme.palette.vesoft.v2.bg2,
  },
  '&:last-child': {
    marginBottom: 0,
  },
}));

// 组节点组件 - React Flow 原生 group 支持
const GroupNode = () => {
  const theme = useTheme();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: `${theme.palette.vesoft.v2.plangroup}33`,
        borderRadius: '12px',
        border: `2px dashed  ${theme.palette.vesoft.v2.border1}`,
      }}
    />
  );
};

const nodeTypes = {
  [NodeLevelType.Level1]: ({ data }: { data: GQLResultPlanInfo }) => (
    <BaseNode type={NodeLevelType.Level1} data={data} />
  ),
  [NodeLevelType.Level2]: ({ data }: { data: GQLResultPlanInfo }) => (
    <BaseNode type={NodeLevelType.Level2} data={data} />
  ),
  [NodeLevelType.Level3]: ({ data }: { data: GQLResultPlanInfo }) => (
    <BaseNode type={NodeLevelType.Level3} data={data} />
  ),
  [NodeLevelType.Level4]: ({ data }: { data: GQLResultPlanInfo }) => (
    <BaseNode type={NodeLevelType.Level4} data={data} />
  ),
  [NodeLevelType.Level5]: ({ data }: { data: GQLResultPlanInfo }) => (
    <BaseNode type={NodeLevelType.Level5} data={data} />
  ),
  group: GroupNode,
};

const edgeTypes = {
  'plan-edge': PlanEdge,
};

interface FlowWithInitialViewProps {
  nodes: Node[];
  showMiniMap: boolean;
  setShowMiniMap: (show: boolean) => void;
  focusNodeId: string | null;
  setFocusNodeId: (id: string | null) => void;
}

function FlowWithInitialView({
  nodes,
  showMiniMap,
  setShowMiniMap,
  focusNodeId,
  setFocusNodeId,
}: FlowWithInitialViewProps) {
  const { t } = useTranslation(['explain']);
  const theme = useTheme();
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();

  useEffect(() => {
    if (nodes.length === 0) return;
    const timer = setTimeout(() => {
      fitView({
        padding: 0.2,
        minZoom: 0.3,
        maxZoom: 1.5,
        duration: 300,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [nodes.length, fitView]);

  // 处理节点定位
  useEffect(() => {
    if (!focusNodeId) return;
    if (nodes.length === 0) return;
    const targetNode = nodes.find((node) => node.data?.id === focusNodeId);
    if (!targetNode) return;
    const timer = setTimeout(() => {
      fitView({
        nodes: [{ id: targetNode.id }],
        padding: 0.3,
        minZoom: 0.8,
        maxZoom: 1.5,
        duration: 500,
      });
      setFocusNodeId(null); // 重置定位状态
    }, 100);

    return () => clearTimeout(timer);
  }, [focusNodeId, nodes, fitView, setFocusNodeId]);

  const nodeClassName = (node: Node) => {
    if (node.type === 'group') return 'minimap-group-node';

    switch (node.type) {
      case NodeLevelType.Level1:
        return 'minimap-level1-node';
      case NodeLevelType.Level2:
        return 'minimap-level2-node';
      case NodeLevelType.Level3:
        return 'minimap-level3-node';
      case NodeLevelType.Level4:
        return 'minimap-level4-node';
      default:
        return 'minimap-default-node';
    }
  };

  // MiniMap 节点颜色函数
  const nodeColor = (node: Node) => {
    if (node.type === 'group') return 'transparent';

    switch (node.type) {
      case NodeLevelType.Level1:
        return theme.palette.vesoft.v2.plannode1;
      case NodeLevelType.Level2:
        return theme.palette.vesoft.v2.plannode2;
      case NodeLevelType.Level3:
        return theme.palette.vesoft.v2.plannode3;
      case NodeLevelType.Level4:
        return theme.palette.vesoft.v2.plannode4;
      default:
        return theme.palette.vesoft.v2.bg4;
    }
  };

  const nodeStrokeColor = (node: Node) => {
    if (node.type === 'group') return `${theme.palette.vesoft.v2.border1}66`;

    switch (node.type) {
      case NodeLevelType.Level1:
        return theme.palette.vesoft.v2.plannode1;
      case NodeLevelType.Level2:
        return theme.palette.vesoft.v2.plannode2;
      case NodeLevelType.Level3:
        return theme.palette.vesoft.v2.plannode3;
      case NodeLevelType.Level4:
        return theme.palette.vesoft.v2.plannode4;
      default:
        return theme.palette.vesoft.v2.border1;
    }
  };

  return (
    <>
      <Controls
        position="bottom-left"
        showZoom={false}
        showInteractive={false}
        showFitView={false}
        fitViewOptions={{
          padding: 0.2,
          minZoom: 1.0,
          maxZoom: 1.5,
        }}
      >
        <Tooltip title={t('zoomIn', { ns: 'explain' })}>
          <MiniMapToggleButton onClick={() => zoomIn()} size="small">
            <AddFilled />
          </MiniMapToggleButton>
        </Tooltip>
        <Tooltip title={t('zoomOut', { ns: 'explain' })}>
          <MiniMapToggleButton onClick={() => zoomOut()} size="small">
            <Minus />
          </MiniMapToggleButton>
        </Tooltip>
        <Tooltip title={showMiniMap ? t('hideMiniMap', { ns: 'explain' }) : t('showMiniMap', { ns: 'explain' })}>
          <MiniMapToggleButton onClick={() => setShowMiniMap(!showMiniMap)} size="small">
            <MonitorDashboard
              sx={{
                color: showMiniMap ? (theme) => theme.palette.vesoft.v2.primary3 : null,
              }}
            />
          </MiniMapToggleButton>
        </Tooltip>
      </Controls>
      {showMiniMap && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '0',
            left: '24px',
            display: 'inline-block',
          }}
        >
          <MiniMap
            zoomable
            pannable
            nodeClassName={nodeClassName}
            nodeColor={nodeColor}
            nodeStrokeColor={nodeStrokeColor}
            nodeStrokeWidth={2}
            position="bottom-left"
            ariaLabel="React Flow Mini Map"
            style={{
              backgroundColor: theme.palette.vesoft.v2.bg1,
              border: `1px solid ${theme.palette.vesoft.v2.border1}`,
              borderRadius: '8px',
            }}
            maskColor={theme.palette.vesoft.v2.error1}
            maskStrokeColor={theme.palette.vesoft.v2.error1}
            maskStrokeWidth={3}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 18,
              left: 36,
              backgroundColor: `${theme.palette.vesoft.v2.bg1}E6`,
              color: theme.palette.vesoft.v2.text1,
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500,
              userSelect: 'none',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {Math.round(zoom * 100)}%
          </Box>
        </Box>
      )}
      <Background variant={BackgroundVariant.Dots} gap={20} size={4} color={theme.palette.vesoft.v2.divider2} />
    </>
  );
}

function ExplainInfo(props: ExplainInfoProps) {
  const { summary } = props;
  const { t } = useTranslation(['explain']);

  const flowId = React.useMemo(() => `explain-flow-${Math.random().toString(36).substr(2, 9)}`, []);

  // 所有hooks必须在组件顶层调用，在任何条件判断之前
  const { nodes: initialNodes, edges: initialEdges, allNodesData } = usePlanData(summary);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeData, setSelectedNodeData] = useState<GQLResultPlanInfo | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!summary.planInfo) return;

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.type === 'group') return node;

        const isSelected = selectedNodeData?.id === node.data.id;
        return {
          ...node,
          data: {
            ...node.data,
            selected: isSelected,
          },
        };
      })
    );
  }, [selectedNodeData, setNodes, summary.planInfo]);

  if (!summary.planInfo) {
    return <EmptyContainer>{t('noPlanInfo', { ns: 'explain' })}</EmptyContainer>;
  }

  const onNodeClick: NodeMouseHandler = (_, node) => {
    if (node.type === 'group') return;
    setSelectedNodeData(node.data as unknown as GQLResultPlanInfo);
  };

  const onPaneClick = () => {
    setSelectedNodeData(null);
  };

  const handleDrawerClose = () => {
    setSelectedNodeData(null);
  };

  // 定位到指定节点的函数
  const handleNodeFocus = (nodeId: string) => {
    const targetNode = nodes.find((node) => node.data?.id === nodeId);
    if (targetNode) {
      setFocusNodeId(nodeId);
    }
  };

  return (
    <ReactFlowProvider>
      <ExplainInfoContainer
        sx={{ position: 'relative', border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider2}` }}
      >
        <ReactFlow
          id={flowId}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={false}
          defaultViewport={{ x: 0, y: 0, zoom: 0.3 }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          snapToGrid={true}
          snapGrid={[15, 15]}
          deleteKeyCode={null}
          multiSelectionKeyCode={null}
          minZoom={0.1}
          maxZoom={2.0}
        >
          <FlowWithInitialView
            nodes={nodes}
            showMiniMap={showMiniMap}
            setShowMiniMap={setShowMiniMap}
            focusNodeId={focusNodeId}
            setFocusNodeId={setFocusNodeId}
          />
        </ReactFlow>

        <PlanNodeDrawer
          key="plan-node-drawer"
          open={true}
          onClose={handleDrawerClose}
          nodeData={selectedNodeData}
          allNodesData={allNodesData}
          summary={summary}
          onNodeFocus={handleNodeFocus}
        />
      </ExplainInfoContainer>
    </ReactFlowProvider>
  );
}

export default ExplainInfo;
