import { EdgeProps } from '@xyflow/react';
import { useTheme } from '@mui/material';

export default function PlanEdge(props: EdgeProps) {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, data } = props;

  const theme = useTheme();

  // 获取 explainType 信息
  const explainType = data?.explainType || '';

  // 计算缩短后的source位置，为箭头留出空间
  const getAdjustedSourcePosition = () => {
    const offset = -5; // 向source节点内侧偏移15px

    switch (sourcePosition) {
      case 'top':
        return { x: sourceX, y: sourceY + offset };
      case 'bottom':
        return { x: sourceX, y: sourceY - offset };
      case 'left':
        return { x: sourceX + offset, y: sourceY };
      case 'right':
        return { x: sourceX - offset, y: sourceY };
      default:
        return { x: sourceX, y: sourceY };
    }
  };

  const adjustedSource = getAdjustedSourcePosition();

  // 直接计算标签位置，不需要完整的 getBezierPath
  const labelX = (adjustedSource.x + targetX) / 2;
  const labelY = (adjustedSource.y + targetY) / 2;
  const flowData = (data?.rows || 0) as number;

  // 在 explain 模式下，即使有数据也不显示流量标签
  const formattedFlow =
    explainType === 'explain' || explainType === 'explain_verbose'
      ? ''
      : flowData >= 0
        ? `${flowData.toLocaleString()} rows`
        : '';

  // 根据数据行数动态计算边线宽度 - 渐近函数
  const calculateStrokeWidth = (rows: number) => {
    if (rows <= 0) return 2;

    // 使用对数函数实现渐近效果
    // 当 rows -> 0 时，width -> 2
    // 当 rows -> ∞ 时，width -> 72
    // 使用 ln(rows + 1) 确保在 rows = 0 时有定义

    const minWidth = 2;
    const maxWidth = 72;
    const growthFactor = 10; // 控制增长速度，值越大增长越慢

    // 对数函数：width = minWidth + (maxWidth - minWidth) * ln(rows/growthFactor + 1) / ln(很大的数/growthFactor + 1)
    // 为了让函数在合理范围内接近渐近线，我们选择一个参考点
    const referenceRows = 1000000; // 参考点：100万行时接近最大宽度
    const normalizedLog = Math.log(rows / growthFactor + 1) / Math.log(referenceRows / growthFactor + 1);

    const width = minWidth + (maxWidth - minWidth) * normalizedLog;

    // 确保宽度在合理范围内
    return Math.max(Math.min(Math.round(width), maxWidth), minWidth);
  };

  const strokeWidth = calculateStrokeWidth(flowData);
  const edgeColor = theme.palette.vesoft.v2.border1;

  // 箭头配置：与边线宽度成比例
  const arrowLength = 8; // 箭头长度，增大让箭头更明显
  const arrowWidth = Math.max(16, strokeWidth * 2); // 箭头宽度，确保最小宽度

  // 计算箭头位置 - 箭头放在边线起始位置
  const getArrowTransform = () => {
    // 箭头放在边线起始位置，向节点方向偏移一些距离
    const finalX = adjustedSource.x;
    const finalY = adjustedSource.y - 5;
    const angle = -90; // 默认指向上方

    return {
      x: finalX,
      y: finalY,
      angle: angle,
    };
  };

  const arrowTransform = getArrowTransform();

  const textWidth = Math.max(60, formattedFlow.length * 8 + 16);
  const textHeight = 24;

  // 计算标签在贝塞尔曲线上的旋转角度 - 使用调整后的source位置
  const getLabelRotation = () => {
    const offsetX = Math.abs(targetX - adjustedSource.x) / 2;
    const offsetY = Math.abs(targetY - adjustedSource.y) / 2;

    // 根据连接位置计算控制点 - 使用调整后的source位置
    let controlPointX1, controlPointY1, controlPointX2, controlPointY2;

    if (sourcePosition === 'right') {
      controlPointX1 = adjustedSource.x + offsetX;
      controlPointY1 = adjustedSource.y;
    } else if (sourcePosition === 'left') {
      controlPointX1 = adjustedSource.x - offsetX;
      controlPointY1 = adjustedSource.y;
    } else if (sourcePosition === 'bottom') {
      controlPointX1 = adjustedSource.x;
      controlPointY1 = adjustedSource.y + offsetY;
    } else {
      // top
      controlPointX1 = adjustedSource.x;
      controlPointY1 = adjustedSource.y - offsetY;
    }

    if (targetPosition === 'left') {
      controlPointX2 = targetX - offsetX;
      controlPointY2 = targetY;
    } else if (targetPosition === 'right') {
      controlPointX2 = targetX + offsetX;
      controlPointY2 = targetY;
    } else if (targetPosition === 'top') {
      controlPointX2 = targetX;
      controlPointY2 = targetY - offsetY;
    } else {
      // bottom
      controlPointX2 = targetX;
      controlPointY2 = targetY + offsetY;
    }

    // 在50%位置计算切线方向
    const t = 0.5;

    // 计算贝塞尔曲线在t=0.5位置的切线向量（一阶导数）
    const tangentX =
      3 * Math.pow(1 - t, 2) * (controlPointX1 - adjustedSource.x) +
      6 * (1 - t) * t * (controlPointX2 - controlPointX1) +
      3 * Math.pow(t, 2) * (targetX - controlPointX2);

    const tangentY =
      3 * Math.pow(1 - t, 2) * (controlPointY1 - adjustedSource.y) +
      6 * (1 - t) * t * (controlPointY2 - controlPointY1) +
      3 * Math.pow(t, 2) * (targetY - controlPointY2);

    // 计算切线角度（弧度转度）
    const tangentAngle = Math.atan2(tangentY, tangentX) * (180 / Math.PI);

    // 计算与切线垂直（正交）的角度 - 完全垂直
    let orthogonalAngle = tangentAngle + 90;

    // 标准化角度到 [-90, 90] 范围，避免文字倒置
    while (orthogonalAngle > 90) {
      orthogonalAngle -= 180;
    }
    while (orthogonalAngle < -90) {
      orthogonalAngle += 180;
    }

    return orthogonalAngle;
  };

  const labelRotation = getLabelRotation();

  // 计算边线路径 - 根据是否有标签决定是否截断
  const getEdgePaths = () => {
    const curvature = 0.25;

    // 根据 sourcePosition 和 targetPosition 计算控制点，使用调整后的source位置
    let controlPointX1, controlPointY1, controlPointX2, controlPointY2;

    if (sourcePosition === 'bottom' && targetPosition === 'top') {
      controlPointX1 = adjustedSource.x;
      controlPointY1 = adjustedSource.y + Math.abs(targetY - adjustedSource.y) * curvature;
      controlPointX2 = targetX;
      controlPointY2 = targetY - Math.abs(targetY - adjustedSource.y) * curvature;
    } else if (sourcePosition === 'top' && targetPosition === 'bottom') {
      controlPointX1 = adjustedSource.x;
      controlPointY1 = adjustedSource.y - Math.abs(targetY - adjustedSource.y) * curvature;
      controlPointX2 = targetX;
      controlPointY2 = targetY + Math.abs(targetY - adjustedSource.y) * curvature;
    } else if (sourcePosition === 'right' && targetPosition === 'left') {
      controlPointX1 = adjustedSource.x + Math.abs(targetX - adjustedSource.x) * curvature;
      controlPointY1 = adjustedSource.y;
      controlPointX2 = targetX - Math.abs(targetX - adjustedSource.x) * curvature;
      controlPointY2 = targetY;
    } else {
      controlPointX1 = adjustedSource.x + Math.abs(targetX - adjustedSource.x) * curvature;
      controlPointY1 = adjustedSource.y;
      controlPointX2 = targetX - Math.abs(targetX - adjustedSource.x) * curvature;
      controlPointY2 = targetY;
    }

    // 如果没有标签，返回完整的连续路径
    if (!formattedFlow) {
      const fullPath = `M${adjustedSource.x},${adjustedSource.y} C${controlPointX1},${controlPointY1} ${controlPointX2},${controlPointY2} ${targetX},${targetY}`;
      return { fullPath, firstPath: null, secondPath: null };
    }

    // 如果有标签，需要截断边线
    // 计算总路径长度（直线距离作为近似）
    const distance = Math.sqrt(Math.pow(targetX - adjustedSource.x, 2) + Math.pow(targetY - adjustedSource.y, 2));

    // 固定的截断空间高度（像素）
    const fixedGapHeight = 24; // 固定24像素的截断空间

    // 将固定像素转换为相对于总路径长度的比例
    const gapSize = Math.min(0.15, fixedGapHeight / (2 * distance)); // 最大不超过15%

    const startT = 0.5 - gapSize;
    const endT = 0.5 + gapSize;

    // 第一段：从调整后的起点到标签前
    const firstSegmentEnd = {
      x:
        Math.pow(1 - startT, 3) * adjustedSource.x +
        3 * Math.pow(1 - startT, 2) * startT * controlPointX1 +
        3 * (1 - startT) * Math.pow(startT, 2) * controlPointX2 +
        Math.pow(startT, 3) * targetX,
      y:
        Math.pow(1 - startT, 3) * adjustedSource.y +
        3 * Math.pow(1 - startT, 2) * startT * controlPointY1 +
        3 * (1 - startT) * Math.pow(startT, 2) * controlPointY2 +
        Math.pow(startT, 3) * targetY,
    };

    // 第二段：从标签后到终点
    const secondSegmentStart = {
      x:
        Math.pow(1 - endT, 3) * adjustedSource.x +
        3 * Math.pow(1 - endT, 2) * endT * controlPointX1 +
        3 * (1 - endT) * Math.pow(endT, 2) * controlPointX2 +
        Math.pow(endT, 3) * targetX,
      y:
        Math.pow(1 - endT, 3) * adjustedSource.y +
        3 * Math.pow(1 - endT, 2) * endT * controlPointY1 +
        3 * (1 - endT) * Math.pow(endT, 2) * controlPointY2 +
        Math.pow(endT, 3) * targetY,
    };

    // 生成第一段路径（从调整后的起点到标签前）
    const firstPath = `M${adjustedSource.x},${adjustedSource.y} C${controlPointX1},${controlPointY1} ${firstSegmentEnd.x},${firstSegmentEnd.y} ${firstSegmentEnd.x},${firstSegmentEnd.y}`;

    // 生成第二段路径（从标签后到终点）
    const secondPath = `M${secondSegmentStart.x},${secondSegmentStart.y} C${secondSegmentStart.x},${secondSegmentStart.y} ${controlPointX2},${controlPointY2} ${targetX},${targetY}`;

    return { fullPath: null, firstPath, secondPath };
  };

  const { fullPath, firstPath, secondPath } = getEdgePaths();

  return (
    <>
      {/* 根据是否有标签决定渲染方式 */}
      {fullPath ? (
        // 没有标签时：渲染完整的连续边线
        <path d={fullPath} stroke={edgeColor} strokeWidth={strokeWidth} fill="none" strokeDasharray="none" />
      ) : (
        // 有标签时：渲染截断的分段边线
        <>
          {/* 第一段边线 - 从起点到标签前 */}
          <path d={firstPath || ''} stroke={edgeColor} strokeWidth={strokeWidth} fill="none" strokeDasharray="none" />

          {/* 第二段边线 - 从标签后到终点 */}
          <path d={secondPath || ''} stroke={edgeColor} strokeWidth={strokeWidth} fill="none" strokeDasharray="none" />
        </>
      )}

      {/* 自定义箭头 - 完全匹配边线方向和曲度 */}
      <g transform={`translate(${arrowTransform.x}, ${arrowTransform.y}) rotate(${arrowTransform.angle})`}>
        <path
          d={`M0,0 L-${arrowLength},-${arrowWidth / 2} L-${arrowLength},${arrowWidth / 2} Z`}
          fill={edgeColor}
          stroke="none"
        />
      </g>

      {/* 数据流量标签 - 跟随曲线旋转 */}
      {formattedFlow && (
        <g transform={`translate(${labelX}, ${labelY}) rotate(${labelRotation})`}>
          {/* 标签背景矩形 - 完全透明背景 */}
          <rect
            x={-textWidth / 2}
            y={-textHeight / 2}
            width={textWidth}
            height={textHeight}
            rx={4}
            ry={4}
            fill="transparent"
            stroke="none"
          />

          {/* 数据流量文字 */}
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="500"
            fill={theme.palette.vesoft.v2.text1}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {formattedFlow}
          </text>
        </g>
      )}
    </>
  );
}
