import { PlanNodeData as GQLResultPlanInfo } from '../types';
import { ContainerMap, NodeLevelType, PlanNodeTitle, SpHeader } from './styles';
import { Typography, useTheme } from '@mui/material';
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { formatMicroseconds } from '../../shared/utilities';
import { DEFAULT_GROUP_ID } from './usePlanData';

interface BaseNodeProps {
  type: NodeLevelType;
  data: GQLResultPlanInfo & { selected?: boolean; explainType?: string };
}

const BaseNode = (props: BaseNodeProps) => {
  const { type, data } = props;

  const Container = ContainerMap[type];
  const theme = useTheme();
  const isExplainMode = data.explainType === 'explain';

  return (
    <Container
      sx={{
        ...(isExplainMode && {
          backgroundColor: theme.palette.vesoft.v2.bg3,
        }),
        ...(data.selected && {
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-2px',
            left: '-3px',
            right: '-3px',
            bottom: '-3px',
            border: `2px solid ${theme.palette.vesoft.v2.primary3}`,
            borderRadius: '8px',
            pointerEvents: 'none',
            zIndex: -1,
          },
        }),
      }}
    >
      <PlanNodeTitle>
        <SpHeader>{data.groupId !== DEFAULT_GROUP_ID ? `[${data.groupId}]` : ''}</SpHeader>
        {data.showName}
      </PlanNodeTitle>
      {/* 只在非 explain 模式且有时间数据时显示时间信息 */}
      {data.explainType !== 'explain' && Number(data.timeMs) > 0 && (
        <Typography>
          {formatMicroseconds(Number(data.timeMs) * 1000)} ({data.timeMsPercent!}%)
        </Typography>
      )}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </Container>
  );
};

export default memo(BaseNode);
