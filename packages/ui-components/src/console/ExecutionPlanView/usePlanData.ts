import { toPlanNodeData } from '../types';
import { PlanNodeData as GQLResultPlanInfo } from '../types';
import { GQLResultSummary } from '@vesoft-inc/studio-core/contracts';
import { Edge, Node, Position } from '@xyflow/react';
import { useRef } from 'react';
import { NodeLevelType } from './styles';

export const DEFAULT_GROUP_ID = 'webgui_group_id';

// 分组节点信息类型定义
interface GroupNodeInfo {
  node: GQLResultPlanInfo;
  level: number;
  siblingIndex: number;
  parentId?: string;
}

export const usePlanData = (summary: GQLResultSummary | null) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const highlightNodeIdMapRef = useRef<
    Map<
      string,
      {
        nodeId: string;
        timeMs: number;
      }
    >
  >(new Map());

  const totalTimeMsRef = useRef<number>(0);

  // Check if grouping should be disabled based on explainType
  const shouldDisableGrouping = useRef<boolean>(false);

  // Detect if this is explain type data (all timeMs are 0 or very low)
  const isExplainType = useRef<boolean>(false);

  // Get planInfo from summary
  const planInfo = summary?.planInfo ? toPlanNodeData(summary.planInfo) : undefined;

  // 布局配置
  const LAYOUT_CONFIG = {
    NODE_WIDTH: 300,
    NODE_HEIGHT: 110,
    NODE_SPACING_X: 100, // 水平间距
    NODE_SPACING_Y: 50, // 垂直间距（同组内竖向排列）
    GROUP_SPACING: 300, // 不同group之间的水平间距
    GROUP_SPACING_Y: 200, // 不同group之间的垂直间距
    GROUP_PADDING: 30, // 组内边距
    GROUP_MIN_WIDTH: 360, // 组最小宽度，调整为适应 300px 宽度的节点
    GROUP_MIN_HEIGHT: 200, // 组最小高度
  };

  // 节点位置信息
  interface NodePosition {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    groupId: string;
    level: number;
  }

  // 计算组的尺寸和位置
  const calculateGroupLayout = (groupNodes: GroupNodeInfo[]) => {
    // 计算该组内最大的兄弟节点数量（只考虑当前组内的节点）
    const groupParentChildrenMap = new Map<string, GroupNodeInfo[]>();
    groupNodes.forEach((nodeInfo) => {
      if (nodeInfo.parentId) {
        if (!groupParentChildrenMap.has(nodeInfo.parentId)) {
          groupParentChildrenMap.set(nodeInfo.parentId, []);
        }
        groupParentChildrenMap.get(nodeInfo.parentId)!.push(nodeInfo);
      }
    });

    let maxSiblingCount = 1;
    groupParentChildrenMap.forEach((siblings) => {
      maxSiblingCount = Math.max(maxSiblingCount, siblings.length);
    });

    // 根据最大兄弟节点数量调整组宽度，使用紧凑间距
    const minWidthForSiblings =
      maxSiblingCount * LAYOUT_CONFIG.NODE_WIDTH +
      (maxSiblingCount - 1) * 40 + // 节点间 40px 间距
      LAYOUT_CONFIG.GROUP_PADDING * 2;

    const groupWidth = Math.max(LAYOUT_CONFIG.GROUP_MIN_WIDTH, minWidthForSiblings);

    // 计算实际层级数量来确定组高度
    const uniqueLevels = new Set(groupNodes.map((node) => node.level));
    const levelCount = uniqueLevels.size;
    const groupHeight = Math.max(
      LAYOUT_CONFIG.GROUP_MIN_HEIGHT,
      levelCount * LAYOUT_CONFIG.NODE_HEIGHT +
        (levelCount - 1) * LAYOUT_CONFIG.NODE_SPACING_Y +
        LAYOUT_CONFIG.GROUP_PADDING * 2
    );

    return { width: groupWidth, height: groupHeight };
  };

  // 按unionGroupId分组节点
  const groupNodesByGroupId = (allNodes: GroupNodeInfo[]) => {
    const groups = new Map<string, GroupNodeInfo[]>();
    allNodes.forEach((item) => {
      const unionGroupId = item.node.unionGroupId || 'default';
      if (!groups.has(unionGroupId)) {
        groups.set(unionGroupId, []);
      }
      groups.get(unionGroupId)!.push(item);
    });

    return groups;
  };

  // 分析父子关系
  const analyzeParentChildRelations = (groups: Map<string, GroupNodeInfo[]>) => {
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string>();

    // 建立父子组关系映射
    groups.forEach((groupNodes, unionGroupId) => {
      groupNodes.forEach(({ parentId }) => {
        if (parentId) {
          // 找到父节点所属的组
          for (const [parentUnionGroupId, parentGroupNodes] of groups) {
            if (parentGroupNodes.some((n) => n.node.id === parentId)) {
              if (parentUnionGroupId !== unionGroupId) {
                // 建立父子组关系
                if (!parentChildMap.has(parentUnionGroupId)) {
                  parentChildMap.set(parentUnionGroupId, []);
                }
                if (!parentChildMap.get(parentUnionGroupId)!.includes(unionGroupId)) {
                  parentChildMap.get(parentUnionGroupId)!.push(unionGroupId);
                }
                childParentMap.set(unionGroupId, parentUnionGroupId);
              }
              break;
            }
          }
        }
      });
    });

    return { parentChildMap, childParentMap };
  };

  // 计算组的基础位置 - 深度优先 + 子组垂直下方布局 + 重叠检测
  const calculateGroupBasePositions = (groups: Map<string, GroupNodeInfo[]>) => {
    const groupPositions = new Map<string, { baseX: number; baseY: number; width: number; height: number }>();
    const { parentChildMap, childParentMap } = analyzeParentChildRelations(groups);

    // 追踪每个Y轴位置的占用范围
    const yAxisOccupancy = new Map<number, Array<{ startX: number; endX: number }>>();

    // 检查指定位置是否与已存在的组重叠
    const checkOverlap = (targetX: number, targetY: number, width: number, height: number) => {
      for (let y = targetY; y < targetY + height; y += 10) {
        // 每10px检查一次
        const occupiedRanges = yAxisOccupancy.get(y) || [];
        for (const range of occupiedRanges) {
          if (targetX < range.endX && targetX + width > range.startX) {
            return true; // 有重叠
          }
        }
      }
      return false;
    };

    // 找到无重叠的X位置
    const findNonOverlapX = (startX: number, targetY: number, width: number, height: number) => {
      let currentX = startX;
      while (checkOverlap(currentX, targetY, width, height)) {
        // 找到该Y轴位置最右端的占用位置
        let maxEndX = currentX;
        for (let y = targetY; y < targetY + height; y += 10) {
          const occupiedRanges = yAxisOccupancy.get(y) || [];
          for (const range of occupiedRanges) {
            if (range.startX <= currentX + width && range.endX > currentX) {
              maxEndX = Math.max(maxEndX, range.endX);
            }
          }
        }
        currentX = maxEndX + LAYOUT_CONFIG.GROUP_SPACING;
      }
      return currentX;
    };

    // 记录组的占用范围
    const recordOccupancy = (x: number, y: number, width: number, height: number) => {
      for (let currentY = y; currentY < y + height; currentY += 10) {
        if (!yAxisOccupancy.has(currentY)) {
          yAxisOccupancy.set(currentY, []);
        }
        yAxisOccupancy.get(currentY)!.push({ startX: x, endX: x + width });
      }
    };

    // 找到根组（没有父组的组）
    const rootGroups = Array.from(groups.keys()).filter((unionGroupId) => !childParentMap.has(unionGroupId));

    // 递归布局函数
    const layoutGroup = (unionGroupId: string, preferredX: number, preferredY: number, usedPositions: Set<string>) => {
      if (usedPositions.has(unionGroupId)) return { nextX: preferredX, nextY: preferredY };
      usedPositions.add(unionGroupId);

      const groupNodes = groups.get(unionGroupId)!;
      const groupLayout = calculateGroupLayout(groupNodes);

      // 找到无重叠的实际位置
      const actualX = findNonOverlapX(preferredX, preferredY, groupLayout.width, groupLayout.height);

      // 设置当前组位置
      groupPositions.set(unionGroupId, {
        baseX: actualX,
        baseY: preferredY,
        width: groupLayout.width,
        height: groupLayout.height,
      });

      // 记录占用范围
      recordOccupancy(actualX, preferredY, groupLayout.width, groupLayout.height);

      let currentX = actualX;
      let maxHeight = groupLayout.height;

      // 处理子组
      const childGroups = parentChildMap.get(unionGroupId) || [];
      if (childGroups.length > 0) {
        // 第一个子组放在父组的垂直下方
        const firstChildY = preferredY + groupLayout.height + LAYOUT_CONFIG.GROUP_SPACING_Y;
        let childX = actualX; // 第一个子组与父组左对齐

        childGroups.forEach((childUnionGroupId) => {
          layoutGroup(childUnionGroupId, childX, firstChildY, usedPositions);
          const childPosition = groupPositions.get(childUnionGroupId)!;

          // 更新最大高度（包含子组的高度）
          maxHeight = Math.max(maxHeight, firstChildY + childPosition.height - preferredY);

          // 下一个子组的X位置（向右排列）
          childX = childPosition.baseX + childPosition.width + LAYOUT_CONFIG.GROUP_SPACING;

          // 更新currentX为所有子组的最右端
          currentX = Math.max(currentX, childPosition.baseX + childPosition.width);
        });
      }

      return {
        nextX: currentX + LAYOUT_CONFIG.GROUP_SPACING,
        nextY: preferredY + maxHeight + LAYOUT_CONFIG.GROUP_SPACING_Y,
      };
    };

    // 从根组开始布局
    let currentX = 0;
    let currentY = 0;
    const usedPositions = new Set<string>();

    rootGroups.forEach((rootUnionGroupId) => {
      const result = layoutGroup(rootUnionGroupId, currentX, currentY, usedPositions);
      currentX = result.nextX;
      // 如果有多个根组，垂直排列
      if (rootGroups.length > 1) {
        currentY = result.nextY;
        currentX = 0; // 重置X位置
      }
    });

    return groupPositions;
  };

  // Check if data is explain type by scanning all nodes
  const detectExplainType = (root: GQLResultPlanInfo) => {
    let totalTime = 0;
    const scanNode = (node: GQLResultPlanInfo) => {
      totalTime += node.timeMs || 0;
      if (node.children) {
        node.children.forEach(scanNode);
      }
    };

    scanNode(root);

    // Only consider it explain type if all timeMs are exactly 0
    // Don't use average check as it may incorrectly flag fast queries as explain type
    isExplainType.current = totalTime === 0;
  };

  const processPlanInfo = (planInfo: GQLResultPlanInfo, parentUnionGroupId = '') => {
    const nodeId = planInfo.id;
    const groupRegex = /\[(.*?)\]/;
    const match = planInfo.name?.match(groupRegex);
    const groupName = match?.[1];
    let groupId = DEFAULT_GROUP_ID;
    if (groupName) {
      groupId = groupName;
    }

    // For explain type data, use a simpler grouping strategy
    if (isExplainType.current) {
      // For explain type, create groups based on operation type patterns
      if (groupName) {
        groupId = groupName;
      }
    }

    // 计算 unionGroupId：父级的 unionGroupId + 当前的 groupId
    // 如果父级 unionGroupId 的最后一段和当前 groupId 相同，则不重复添加
    let unionGroupId = groupId || 'default'; // 如果没有 groupId，使用 'default'
    if (parentUnionGroupId) {
      if (groupId) {
        const parentLastSegment = parentUnionGroupId.split('-').pop();
        if (parentLastSegment !== groupId) {
          unionGroupId = `${parentUnionGroupId}-${groupId}`;
        } else {
          unionGroupId = parentUnionGroupId; // 使用父级的 unionGroupId，不重复添加
        }
      } else {
        unionGroupId = parentUnionGroupId;
      }
    }

    planInfo.groupId = groupId;
    planInfo.unionGroupId = unionGroupId;
    planInfo.showName = planInfo.name?.replace(groupRegex, '').trim();

    // 使用 unionGroupId 来避免重复
    const info = highlightNodeIdMapRef.current?.get(unionGroupId);
    if (info && planInfo.timeMs > info.timeMs) {
      highlightNodeIdMapRef.current?.set(unionGroupId, {
        nodeId,
        timeMs: planInfo.timeMs,
      });
    } else {
      highlightNodeIdMapRef.current?.set(unionGroupId, {
        nodeId,
        timeMs: planInfo.timeMs,
      });
    }
    totalTimeMsRef.current += planInfo.timeMs;
    if (planInfo.children && planInfo.children.length > 0) {
      planInfo.children.forEach((child) => {
        processPlanInfo(child, unionGroupId);
      });
    }
  };

  const getNodeType = (timeMsPercent: number) => {
    // For explain type data, use a different logic since all times are 0
    if (isExplainType.current) {
      // Use a simple rotation for visual differentiation
      return NodeLevelType.Level1; // Default to level 1 for explain type
    }

    // Match the ranges defined in styles.tsx
    if (timeMsPercent < 10) {
      return NodeLevelType.Level1; // 0%-10%
    } else if (timeMsPercent < 20) {
      return NodeLevelType.Level2; // 10%-20%
    } else if (timeMsPercent < 40) {
      return NodeLevelType.Level3; // 20%-40%
    } else if (timeMsPercent < 60) {
      return NodeLevelType.Level4; // 40%-60%
    } else {
      return NodeLevelType.Level5; // 60%-100%
    }
  };

  // 收集所有节点信息
  const collectAllNodes = (
    node: GQLResultPlanInfo,
    level = 0,
    siblingIndex = 0,
    parentId?: string,
    allNodes: GroupNodeInfo[] = []
  ) => {
    allNodes.push({ node, level, siblingIndex, parentId });

    if (node.children && node.children.length > 0) {
      node.children.forEach((child, childIndex) => {
        collectAllNodes(child, level + 1, childIndex, node.id, allNodes);
      });
    }

    return allNodes;
  };

  // 开始处理根节点
  if (planInfo) {
    // Reset refs before processing to ensure correct calculation
    totalTimeMsRef.current = 0;
    highlightNodeIdMapRef.current.clear();

    // Check if grouping should be disabled based on explainType
    const explainType = summary?.explainType || '';
    shouldDisableGrouping.current = explainType === 'explain' || explainType === 'explain_verbose';

    // First detect the data type
    detectExplainType(planInfo);

    processPlanInfo(planInfo);

    // 收集所有节点
    const allNodeInfo = collectAllNodes(planInfo);

    // 计算每个父节点的子节点数量，用于多子节点的水平分布
    const parentChildrenMap = new Map<string, GroupNodeInfo[]>();
    allNodeInfo.forEach((nodeInfo) => {
      if (nodeInfo.parentId) {
        if (!parentChildrenMap.has(nodeInfo.parentId)) {
          parentChildrenMap.set(nodeInfo.parentId, []);
        }
        parentChildrenMap.get(nodeInfo.parentId)!.push(nodeInfo);
      }
    });

    // 按groupId分组
    const groups = groupNodesByGroupId(allNodeInfo);

    // 计算组的基础位置
    const groupBasePositions = calculateGroupBasePositions(groups);

    // 存储已放置的节点位置
    const nodePositions: NodePosition[] = [];

    // For explain type with no meaningful timing data, use index-based coloring
    let nodeIndex = 0;

    // 检测两个节点是否重叠
    const isNodeOverlapping = (node1: NodePosition, node2: NodePosition) => {
      const margin = 10; // 节点之间的最小间距
      return (
        node1.x < node2.x + node2.width + margin &&
        node1.x + node1.width + margin > node2.x &&
        node1.y < node2.y + node2.height + margin &&
        node1.y + node1.height + margin > node2.y &&
        node1.groupId === node2.groupId // 只检测同组内的重叠
      );
    };

    // 调整节点位置避免重叠
    const adjustNodePosition = (nodePos: NodePosition, existingNodes: NodePosition[]) => {
      const adjusted = { ...nodePos };
      let attempts = 0;
      const maxAttempts = 20;

      while (attempts < maxAttempts) {
        let hasOverlap = false;

        for (const existing of existingNodes) {
          if (existing.id !== adjusted.id && isNodeOverlapping(adjusted, existing)) {
            hasOverlap = true;
            // 尝试向右移动
            adjusted.x += LAYOUT_CONFIG.NODE_WIDTH + 50;
            break;
          }
        }

        if (!hasOverlap) break;
        attempts++;
      }

      return adjusted;
    };

    // 为每个组内的节点计算位置 - 按层级排列实现树形布局
    groups.forEach((groupNodes, unionGroupId) => {
      const basePosition = groupBasePositions.get(unionGroupId) || { baseX: 0, baseY: 0, width: 0, height: 0 };

      // 按层级分组节点
      const nodesByLevel = new Map<number, GroupNodeInfo[]>();
      groupNodes.forEach((nodeInfo) => {
        if (!nodesByLevel.has(nodeInfo.level)) {
          nodesByLevel.set(nodeInfo.level, []);
        }
        nodesByLevel.get(nodeInfo.level)!.push(nodeInfo);
      });

      // 按层级处理节点
      Array.from(nodesByLevel.keys())
        .sort((a, b) => a - b)
        .forEach((level, levelIndex) => {
          const levelNodes = nodesByLevel.get(level)!;
          // 使用更紧凑的层级间距，基于实际的层级索引而不是层级数值
          const levelY =
            LAYOUT_CONFIG.GROUP_PADDING + levelIndex * (LAYOUT_CONFIG.NODE_HEIGHT + LAYOUT_CONFIG.NODE_SPACING_Y);

          // 按父节点分组同层级的节点
          const nodesByParent = new Map<string, GroupNodeInfo[]>();
          levelNodes.forEach((nodeInfo) => {
            const parentKey = nodeInfo.parentId || 'root';
            if (!nodesByParent.has(parentKey)) {
              nodesByParent.set(parentKey, []);
            }
            nodesByParent.get(parentKey)!.push(nodeInfo);
          });

          // 处理每个父节点的子节点
          nodesByParent.forEach((siblings) => {
            siblings.forEach(({ node, parentId }, siblingIndex) => {
              const nodeId = node.id;

              // Calculate time percentage, handle division by zero for explain type
              let timeMsPercent = 0;
              if (isExplainType.current) {
                // For explain type, use node index for visual variety (cycling through levels)
                timeMsPercent = (nodeIndex % 5) * 10 + 5; // This will give us 5, 15, 25, 35, 45, cycling
                nodeIndex++;
              } else if (totalTimeMsRef.current > 0) {
                timeMsPercent = Number(((node.timeMs / totalTimeMsRef.current) * 100).toFixed(2));
              }

              const nodeType = getNodeType(timeMsPercent);

              // 计算基础水平位置（组中心）
              let relativeX = (basePosition.width - LAYOUT_CONFIG.NODE_WIDTH) / 2;

              // 实现树形散列布局：优先垂直、两边散开
              if (siblings.length > 1) {
                if (siblingIndex === 0) {
                  // 第一个节点放在正下方（垂直优先）
                  relativeX = (basePosition.width - LAYOUT_CONFIG.NODE_WIDTH) / 2;
                } else {
                  // 其他节点左右交替分布
                  const isLeft = siblingIndex % 2 === 1; // 奇数索引放左边，偶数索引放右边
                  const distance = Math.ceil(siblingIndex / 2); // 距离中心的距离
                  // 使用紧凑的水平间距
                  const compactSpacing = LAYOUT_CONFIG.NODE_WIDTH + 40; // 节点宽度 + 40px 间距
                  const offset = distance * compactSpacing;

                  if (isLeft) {
                    // 放在左边
                    relativeX = (basePosition.width - LAYOUT_CONFIG.NODE_WIDTH) / 2 - offset;
                  } else {
                    // 放在右边
                    relativeX = (basePosition.width - LAYOUT_CONFIG.NODE_WIDTH) / 2 + offset;
                  }
                }
              }

              // 使用层级计算的Y位置
              const relativeY = levelY;

              // 节点的绝对位置
              const nodeX = basePosition.baseX + relativeX;
              const nodeY = basePosition.baseY + relativeY;

              // 创建初始节点位置
              const initialNodePos: NodePosition = {
                id: nodeId,
                x: nodeX,
                y: nodeY,
                width: LAYOUT_CONFIG.NODE_WIDTH,
                height: LAYOUT_CONFIG.NODE_HEIGHT,
                groupId: unionGroupId,
                level,
              };

              // 调整位置避免重叠
              const adjustedNodePos = adjustNodePosition(initialNodePos, nodePositions);

              // 记录调整后的节点位置
              nodePositions.push(adjustedNodePos);

              // Create node with proper default values and error handling
              const nodeData = {
                ...node,
                timeMsPercent,
                // Ensure all required fields have default values
                timeMs: node.timeMs || 0,
                rows: node.rows || 0,
                memoryKib: node.memoryKib || 0,
                explainType: summary?.explainType, // 传递 explainType 到节点数据
              };

              // 创建节点 - 使用 React Flow 的 parentId 来实现组约束
              const reactFlowNode: Node = {
                id: nodeId,
                type: nodeType,
                position: {
                  x: shouldDisableGrouping.current ? adjustedNodePos.x : adjustedNodePos.x - basePosition.baseX, // 如果禁用分组，使用绝对坐标
                  y: shouldDisableGrouping.current ? adjustedNodePos.y : adjustedNodePos.y - basePosition.baseY,
                },
                data: nodeData,
                sourcePosition: Position.Bottom,
                targetPosition: Position.Top,
                draggable: true,
                selectable: true,
              };

              // Only set parent and extent for grouped nodes (not default group and grouping is enabled)
              if (!shouldDisableGrouping.current && unionGroupId !== 'default' && unionGroupId !== '') {
                reactFlowNode.parentId = `group-${unionGroupId}`;
                reactFlowNode.extent = 'parent';
              }

              nodes.push(reactFlowNode);

              // 创建边 - 智能边线类型选择
              if (parentId) {
                // 查找父节点的组ID，使用调整后的位置
                const parentNode = nodePositions.find((n) => n.id === parentId);
                const isCrossGroup = parentNode && parentNode.groupId !== unionGroupId;

                edges.push({
                  id: `edge-${parentId}-${nodeId}`,
                  source: parentId,
                  target: nodeId,
                  type: 'plan-edge',
                  animated: false,
                  data: {
                    rows: node.rows || 0, // 传递行数数据
                    isCrossGroup, // 标记是否为跨组连接
                    explainType: summary?.explainType, // 传递 explainType 信息
                  },
                  style: isCrossGroup
                    ? {
                        strokeDasharray: '5,5', // 跨组连接使用虚线
                      }
                    : {},
                });
              }
            });
          });
        });
    });

    // 重新计算组宽度，考虑防重叠调整后的实际节点位置
    const recalculateGroupWidths = () => {
      const updatedGroupPositions = new Map(groupBasePositions);

      groups.forEach((_, unionGroupId) => {
        const currentPosition = groupBasePositions.get(unionGroupId);
        if (!currentPosition) return;

        // 找到该组内所有节点的实际位置
        const groupNodePositions = nodePositions.filter((pos) => pos.groupId === unionGroupId);

        if (groupNodePositions.length > 0) {
          // 计算节点的最左和最右边界（相对于组的基准位置）
          const relativePositions = groupNodePositions.map((pos) => ({
            left: pos.x - currentPosition.baseX,
            right: pos.x - currentPosition.baseX + pos.width,
          }));

          const minLeft = Math.min(...relativePositions.map((p) => p.left));
          const maxRight = Math.max(...relativePositions.map((p) => p.right));

          // 计算实际需要的组宽度（包含padding）
          const actualRequiredWidth = Math.max(
            maxRight - Math.min(0, minLeft) + LAYOUT_CONFIG.GROUP_PADDING * 2,
            LAYOUT_CONFIG.GROUP_MIN_WIDTH
          );

          // 更新组宽度
          if (actualRequiredWidth > currentPosition.width) {
            updatedGroupPositions.set(unionGroupId, {
              ...currentPosition,
              width: actualRequiredWidth,
            });
          }
        }
      });

      return updatedGroupPositions;
    };

    // 应用重新计算的组宽度
    const finalGroupPositions = recalculateGroupWidths();

    // 创建组节点 - React Flow 原生 group 功能 (only if grouping is enabled)
    const groupNodes: Node[] = [];
    if (!shouldDisableGrouping.current) {
      finalGroupPositions.forEach((position, unionGroupId) => {
        if (unionGroupId !== 'default' && unionGroupId !== '') {
          // 不为默认组和空组创建背景
          // 从该组的第一个节点获取原始的 groupId 用于显示
          const groupNodesInGroup = groups.get(unionGroupId);
          const displayGroupId =
            groupNodesInGroup && groupNodesInGroup.length > 0
              ? groupNodesInGroup[0].node.groupId || unionGroupId
              : unionGroupId;

          groupNodes.push({
            id: `group-${unionGroupId}`,
            type: 'group',
            position: {
              x: position.baseX,
              y: position.baseY,
            },
            data: {
              label: displayGroupId ? `[${displayGroupId}]` : '',
              groupId: unionGroupId,
            },
            style: {
              width: position.width,
              height: position.height,
              // backgroundColor: `${theme.palette.vesoft.v2.border1}4D`,
              borderRadius: '12px',
              zIndex: -1,
            },
            draggable: true,
            selectable: true,
            className: 'react-flow__node-group',
          });
        }
      });
    }

    return {
      nodes: [...groupNodes, ...nodes],
      edges,
      groupPositions: finalGroupPositions,
      allNodesData: allNodeInfo.map((item) => item.node), // 返回所有节点数据用于 Drawer
    };
  }

  return {
    nodes,
    edges,
    groupPositions: new Map(),
    allNodesData: [],
  };
};
