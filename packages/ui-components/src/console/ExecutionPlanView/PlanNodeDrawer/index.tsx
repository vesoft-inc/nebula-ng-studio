import React from 'react';
import { Box, Typography, Divider, List, ListItem, useTheme } from '@mui/material';
import { ChevronLeftFilled, ChevronRightFilled } from '@vesoft-inc/icons';
import { useTranslation } from 'react-i18next';
import GroupButton from '../../../shared/SegmentButton/index';
import { GQLResultPlanInfo, GQLResultSummary } from '@vesoft-inc/utils';
import { formatMicroseconds } from '../../../shared/utilities';
import {
  DrawerToggle,
  DrawerContainer,
  DrawerContent,
  DrawerHeader,
  SectionTitle,
  StyledButtonGroup,
  StatItem,
  StatValue,
  TimeBreakdownItem,
  TimeLabel,
  TimeIndicator,
  TimeValue,
  ProgressContainer,
  InfoListItem,
  InfoLabel,
  InfoValue,
  InfoValueMonospace,
} from './styles';
import { PlanNodeDrawerProps, TabType } from './types';
import { DEFAULT_GROUP_ID } from '../usePlanData';

// 时间阶段配置
const TIME_PHASES = {
  consume: {
    colorKey: 'planConsume',
    getValue: (nodeData: GQLResultPlanInfo) =>
      nodeData.consumeMs !== undefined ? formatMicroseconds(nodeData.consumeMs * 1000) : '-',
    getNumericValue: (nodeData: GQLResultPlanInfo) => nodeData.consumeMs ?? 0,
  },
  produce: {
    colorKey: 'planProduce',
    getValue: (nodeData: GQLResultPlanInfo) => formatMicroseconds((nodeData.timeMs ?? 0) * 1000),
    getNumericValue: (nodeData: GQLResultPlanInfo) => nodeData.timeMs ?? 0,
  },
  finish: {
    colorKey: 'planFinish',
    getValue: (nodeData: GQLResultPlanInfo) =>
      nodeData.finishMs !== undefined ? formatMicroseconds(nodeData.finishMs * 1000) : '-',
    getNumericValue: (nodeData: GQLResultPlanInfo) => nodeData.finishMs ?? 0,
  },
} as const;

type TimePhase = keyof typeof TIME_PHASES;

// 其他信息配置
const INFO_FIELDS = [
  {
    key: 'memory',
    label: 'memory:',
    getValue: (nodeData: GQLResultPlanInfo) => `${(nodeData.memoryKib || 0).toFixed(3)} KiB`,
    isMonospace: false,
  },
  {
    key: 'blocked',
    label: 'blocked:',
    getValue: (nodeData: GQLResultPlanInfo) =>
      nodeData.blockedMs !== undefined ? formatMicroseconds(nodeData.blockedMs * 1000) : '-',
    isMonospace: false,
  },
  {
    key: 'queued',
    label: 'queued:',
    getValue: (nodeData: GQLResultPlanInfo) =>
      nodeData.queuedMs !== undefined ? formatMicroseconds(nodeData.queuedMs * 1000) : '-',
    isMonospace: false,
  },
  {
    key: 'rows',
    label: 'rows:',
    getValue: (nodeData: GQLResultPlanInfo) => `${nodeData.rows ?? '-'}`,
    isMonospace: false,
  },
  {
    key: 'batches',
    label: 'batches:',
    getValue: (nodeData: GQLResultPlanInfo) => `${nodeData.batches ?? '-'}`,
    isMonospace: false,
  },
  {
    key: 'concurrency',
    label: 'concurrency:',
    getValue: (nodeData: GQLResultPlanInfo) => `${nodeData.concurrency ?? '-'}`,
    isMonospace: false,
  },
  {
    key: 'details',
    label: 'details:',
    getValue: (nodeData: GQLResultPlanInfo) => `${nodeData.details ?? '-'}`,
    isMonospace: true,
  },
  {
    key: 'columns',
    label: 'columns:',
    getValue: (nodeData: GQLResultPlanInfo) => `[${nodeData.columns ?? '-'}]`,
    isMonospace: true,
  },
] as const;

const TIME_BREAKDOWN_FIELDS = [
  {
    key: 'build',
    colorKey: 'planBuild',
    labelKey: 'buildTime',
    getValue: (summary: GQLResultSummary) => formatMicroseconds(Math.round(summary.buildTimeUs)),
  },
  {
    key: 'optimize',
    colorKey: 'planOptimize',
    labelKey: 'optimizeTime',
    getValue: (summary: GQLResultSummary) => formatMicroseconds(Math.round(summary.optimizeTimeUs)),
  },
  {
    key: 'execute',
    colorKey: 'planExecute',
    labelKey: 'executeTime',
    getValue: (summary: GQLResultSummary) =>
      formatMicroseconds(
        Math.round(summary.totalServerTimeUs - summary.buildTimeUs - summary.optimizeTimeUs - summary.serializeTimeUs)
      ),
  },
  {
    key: 'serialize',
    colorKey: 'planSerialize',
    labelKey: 'serializeTime',
    getValue: (summary: GQLResultSummary) => formatMicroseconds(Math.round(summary.serializeTimeUs)),
  },
] as const;

const PlanNodeDrawer: React.FC<PlanNodeDrawerProps> = ({
  open: _open,
  onClose: _onClose,
  nodeData,
  summary,
  allNodesData = [],
  onNodeFocus,
}) => {
  const theme = useTheme();
  const { t } = useTranslation(['explain']);
  const [activeTab, setActiveTab] = React.useState<TabType>('Time');
  const [isCollapsed, setIsCollapsed] = React.useState(false); // 控制 drawer 展开/收起状态
  const [lastSelectedNodeId, setLastSelectedNodeId] = React.useState<string | null>(null); // 跟踪上次选中的节点ID

  // 根据是否有选中节点来决定显示内容
  const isNodeSelected = !!nodeData;

  // 当选中新节点时，自动打开抽屉
  React.useEffect(() => {
    const currentNodeId = nodeData?.id || null;

    // 如果选中了新的节点
    if (isNodeSelected && currentNodeId !== lastSelectedNodeId) {
      setIsCollapsed(false); // 自动打开抽屉
      setLastSelectedNodeId(currentNodeId);
    }
    // 如果没有选中节点，重置状态
    else if (!isNodeSelected) {
      setLastSelectedNodeId(null);
    }
  }, [isNodeSelected, nodeData?.id, lastSelectedNodeId]);

  // 切换 drawer 状态
  const toggleDrawer = () => {
    setIsCollapsed(!isCollapsed);
  };

  const getTimePhaseColor = (phase: TimePhase) => {
    return theme.palette.vesoft.v2[TIME_PHASES[phase].colorKey];
  };

  // 计算时间阶段比例
  const getTimePhaseRatio = (phase: TimePhase) => {
    if (!nodeData) return 0;

    const phaseValue = TIME_PHASES[phase].getNumericValue(nodeData);
    const totalTime = (Object.keys(TIME_PHASES) as TimePhase[]).reduce(
      (sum, key) => sum + TIME_PHASES[key].getNumericValue(nodeData),
      0
    );

    return totalTime > 0 ? Math.round(phaseValue / totalTime).toFixed(2) : 0;
  };

  // 计算总时间分解比例
  const getTimeBreakdownRatio = (fieldKey: string) => {
    if (!summary) return 0;

    const totalTime = summary.totalServerTimeUs;
    if (totalTime <= 0) return 0;

    let fieldValue = 0;
    switch (fieldKey) {
      case 'build':
        fieldValue = summary.buildTimeUs;
        break;
      case 'optimize':
        fieldValue = summary.optimizeTimeUs;
        break;
      case 'execute':
        fieldValue = summary.totalServerTimeUs - summary.buildTimeUs - summary.optimizeTimeUs - summary.serializeTimeUs;
        break;
      case 'serialize':
        fieldValue = summary.serializeTimeUs;
        break;
      default:
        return 0;
    }

    return fieldValue / totalTime;
  };

  // 计算 Top 5 数据
  const getTop5Data = (sortBy: TabType) => {
    const sortedNodes = [...allNodesData].sort((a, b) => {
      switch (sortBy) {
        case 'Time':
          return (b.timeMs || 0) - (a.timeMs || 0);
        case 'Memory':
          return (b.memoryKib || 0) - (a.memoryKib || 0);
        case 'Rows':
          return (b.rows || 0) - (a.rows || 0);
        default:
          return 0;
      }
    });

    return sortedNodes.slice(0, 5).map((node) => {
      let value: string;
      let percentage: number;

      switch (sortBy) {
        case 'Time': {
          const totalTime = allNodesData.reduce((sum, n) => sum + (n.timeMs || 0), 0);
          value = formatMicroseconds((node.timeMs || 0) * 1000);
          percentage = totalTime > 0 ? ((node.timeMs || 0) / totalTime) * 100 : 0;
          break;
        }
        case 'Memory': {
          const totalMemory = allNodesData.reduce((sum, n) => sum + (n.memoryKib || 0), 0);
          value = `${(node.memoryKib || 0).toFixed(2)}KB`;
          percentage = totalMemory > 0 ? ((node.memoryKib || 0) / totalMemory) * 100 : 0;
          break;
        }
        case 'Rows': {
          const totalRows = allNodesData.reduce((sum, n) => sum + (n.rows || 0), 0);
          value = `${node.rows || 0}`;
          percentage = totalRows > 0 ? ((node.rows || 0) / totalRows) * 100 : 0;
          break;
        }
        default:
          value = '0';
          percentage = 0;
      }

      return {
        id: node.id,
        groupId: node.groupId,
        showName: node.showName || node.name,
        value,
        percentage: percentage.toFixed(2),
      };
    });
  };

  const top5Data = getTop5Data(activeTab);

  const renderNodeName = (
    nodeData: { groupId: string; showName: string; id?: string },
    style: React.CSSProperties = {
      fontSize: 16,
      fontWeight: 600,
    },
    clickable = false
  ) => {
    if (!nodeData) return null;

    return (
      <Typography
        component="div"
        className={clickable ? 'stat-node-name' : ''}
        sx={{
          color: theme.palette.vesoft.v2.text2,
          display: 'flex',
          cursor: 'inherit', // 继承父元素的 cursor 样式
          transition: 'all 0.2s ease-in-out',
          pointerEvents: clickable ? 'none' : 'auto', // 在 clickable 模式下禁用自身的点击事件
          ...style,
        }}
      >
        <Box
          sx={{
            color: theme.palette.vesoft.v2.primary3,
            mr: 0.5,
            fontSize: 'inherit',
            fontWeight: 'inherit',
          }}
        >
          {nodeData.groupId !== DEFAULT_GROUP_ID ? `[${nodeData.groupId}]` : ''}
        </Box>
        <Box
          sx={{
            color: theme.palette.vesoft.v2.text1,
            fontSize: 'inherit',
            fontWeight: 'inherit',
            textOverflow: clickable ? 'ellipsis' : null,
            maxWidth: clickable ? 145 : null,
            overflow: clickable ? 'hidden' : null,
          }}
        >
          {nodeData.showName}
        </Box>
      </Typography>
    );
  };

  const getInfoFields = () => {
    if (summary.explainType === 'profile') {
      const removeList = ['queued', 'batches', 'concurrency', 'columns'];
      return INFO_FIELDS.filter((filed) => !removeList.find((remove) => remove === filed.key));
    }
    if (summary.explainType === 'profile_verbose') {
      return INFO_FIELDS.filter((field) => field.key !== 'columns');
    }
    if (summary.explainType === 'explain_verbose') {
      return INFO_FIELDS.filter((field) => field.key === 'details' || field.key === 'columns');
    }
    return INFO_FIELDS.filter((field) => field.key === 'details');
  };

  // 渲染算子详细信息
  const renderNodeDetails = () => {
    if (!nodeData) return null;

    return (
      <>
        <DrawerHeader>{renderNodeName(nodeData)}</DrawerHeader>
        {summary.explainType === 'profile_verbose' && (
          <>
            <Box sx={{ my: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: 14, color: theme.palette.vesoft.v2.text2, mb: 1 }}>{t('time')}</Typography>
                <Typography sx={{ fontSize: 14, color: theme.palette.vesoft.v2.text1, mb: 1 }}>
                  {formatMicroseconds((nodeData.timeMs || 0) * 1000)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ flex: 1, display: 'flex', height: 8, borderRadius: 1, overflow: 'hidden', gap: 0.5 }}>
                  {(Object.keys(TIME_PHASES) as TimePhase[])
                    .map((phase) => ({ phase, ratio: getTimePhaseRatio(phase) }))
                    .filter(({ ratio }) => Number(ratio) > 0)
                    .map(({ phase, ratio }, index, visiblePhases) => (
                      <Box
                        key={phase}
                        sx={{
                          flex: ratio,
                          backgroundColor: getTimePhaseColor(phase),
                          ...(index === 0 && {
                            borderTopLeftRadius: 4,
                            borderBottomLeftRadius: 4,
                          }),
                          ...(index === visiblePhases.length - 1 && {
                            borderTopRightRadius: 4,
                            borderBottomRightRadius: 4,
                          }),
                        }}
                      />
                    ))}
                </Box>
              </Box>

              <List sx={{ p: 0 }}>
                {(Object.keys(TIME_PHASES) as TimePhase[]).map((phase) => (
                  <ListItem key={phase} sx={{ px: 0, py: 0.5, justifyContent: 'space-between' }}>
                    <TimeLabel>
                      <TimeIndicator color={getTimePhaseColor(phase)} />
                      <Typography sx={{ fontSize: 14, color: theme.palette.vesoft.v2.text2 }}>{phase}</Typography>
                    </TimeLabel>
                    <TimeValue>{TIME_PHASES[phase].getValue(nodeData)}</TimeValue>
                  </ListItem>
                ))}
              </List>
            </Box>

            <Divider sx={{ mb: 1, borderColor: theme.palette.vesoft.v2.border1 }} />
          </>
        )}

        <List sx={{ p: 0 }}>
          {getInfoFields().map((field) => (
            <InfoListItem key={field.key}>
              <InfoLabel>{field.label}</InfoLabel>
              {field.isMonospace ? (
                <InfoValueMonospace>{field.getValue(nodeData)}</InfoValueMonospace>
              ) : (
                <InfoValue>{field.getValue(nodeData)}</InfoValue>
              )}
            </InfoListItem>
          ))}
        </List>
      </>
    );
  };

  const getTimeBreakdownFields = () => {
    if (summary.explainType === 'profile') {
      return TIME_BREAKDOWN_FIELDS;
    }
    return TIME_BREAKDOWN_FIELDS.filter((field) => field.key !== 'execute');
  };

  const renderOverview = () => (
    <>
      {(summary.explainType === 'profile' || summary.explainType === 'profile_verbose') && (
        <>
          <DrawerHeader>
            <SectionTitle>{t('topBy')}</SectionTitle>
            <StyledButtonGroup variant="outlined" size="small">
              {(['Time', 'Memory', 'Rows'] as TabType[]).map((tab) => (
                <GroupButton
                  key={tab}
                  active={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  size="small"
                  sx={{
                    width: 64,
                  }}
                >
                  {t(tab.toLowerCase() as 'time' | 'memory' | 'rows')}
                </GroupButton>
              ))}
            </StyledButtonGroup>
          </DrawerHeader>
          <List sx={{ p: 0 }}>
            {top5Data.map((item, index) => (
              <StatItem key={index} clickable={true} onClick={() => onNodeFocus && onNodeFocus(item.id)}>
                {renderNodeName(
                  item,
                  {
                    fontSize: 14,
                  },
                  true
                )}
                <StatValue
                  className="stat-value"
                  sx={{ pointerEvents: 'none' }} // 禁用点击事件，让父元素处理
                >
                  {activeTab === 'Rows' ? item.value : `${item.value}(${item.percentage}%)`}
                </StatValue>
              </StatItem>
            ))}
          </List>
          <Divider sx={{ my: 2, borderColor: theme.palette.vesoft.v2.border1 }} />
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 14, lineHeight: '20px', color: theme.palette.vesoft.v2.text2, fontWeight: 600 }}>
          {t('totalTime')}
        </Typography>
        <Typography sx={{ fontSize: 14, color: theme.palette.vesoft.v2.text3, fontWeight: 400 }}>
          {formatMicroseconds(Math.round(summary.totalServerTimeUs))}
        </Typography>
      </Box>

      <ProgressContainer>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box sx={{ flex: 1, display: 'flex', height: 8, borderRadius: 1, overflow: 'hidden', gap: 0 }}>
            {getTimeBreakdownFields()
              .map((field) => ({ field, ratio: getTimeBreakdownRatio(field.key) }))
              .filter(({ ratio }) => ratio > 0)
              .map(({ field, ratio }, index, visibleFields) => (
                <Box
                  key={field.key}
                  sx={{
                    flex: ratio,
                    backgroundColor: theme.palette.vesoft.v2[field.colorKey],
                    ...(index === 0 && {
                      borderTopLeftRadius: 4,
                      borderBottomLeftRadius: 4,
                    }),
                    ...(index === visibleFields.length - 1 && {
                      borderTopRightRadius: 4,
                      borderBottomRightRadius: 4,
                    }),
                  }}
                />
              ))}
          </Box>
        </Box>
      </ProgressContainer>

      <Box>
        {getTimeBreakdownFields().map((field) => (
          <TimeBreakdownItem key={field.key}>
            <TimeLabel>
              <TimeIndicator color={theme.palette.vesoft.v2[field.colorKey]} />
              <Typography sx={{ fontSize: 14, color: theme.palette.vesoft.v2.text2 }}>{t(field.labelKey)}</Typography>
            </TimeLabel>
            <TimeValue>{field.getValue(summary)}</TimeValue>
          </TimeBreakdownItem>
        ))}
      </Box>
    </>
  );

  return (
    <>
      <DrawerContainer collapsed={isCollapsed}>
        <DrawerToggle onClick={toggleDrawer}>
          {isCollapsed ? <ChevronLeftFilled /> : <ChevronRightFilled />}
        </DrawerToggle>

        <DrawerContent>{isNodeSelected ? renderNodeDetails() : renderOverview()}</DrawerContent>
      </DrawerContainer>
    </>
  );
};

export default PlanNodeDrawer;
