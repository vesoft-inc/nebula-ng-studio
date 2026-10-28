import { memo } from 'react';
import { EdgeProps, EdgeLabelRenderer, BaseEdge, useStore } from '@xyflow/react';
import { useTheme } from '@mui/material';
import { IEdgeTypeItem } from '../../../schema/types';
import { EdgeDirectionType } from '@vesoft-inc/studio-core/contracts';
import { LINE_STYLE } from '../../../shared/styles';
import { NODE_SIZE } from './CustomNode';

interface CustomEdgeData extends Record<string, unknown> {
  edgeTypeItem: IEdgeTypeItem;
  isActive: boolean;
  isReadonly: boolean;
  parallelIndex?: number;
  totalParallel?: number;
}

const NODE_RADIUS = NODE_SIZE / 2;
const EDGE_OFFSET = 8; // Increased offset from node border for better clearance

// Self-loop configuration
const SELF_LOOP_RADIUS = 60; // Base radius of the self-loop curve
const SELF_LOOP_SPREAD = 1.5; // Angular spread between entry/exit points (radians, ~63 degrees)

interface EdgeGeometryParams {
  sourceId: string;
  targetId: string;
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  parallelIndex?: number;
  totalParallel?: number;
}

export interface EdgeGeometryResult {
  path: string;
  labelPos: { x: number; y: number };
  isSelfLoop: boolean;
}

// Exposed helper to calculate edge path/label for rendering or previews
export const calculateEdgeGeometry = ({
  sourceId,
  targetId,
  sourcePosition,
  targetPosition,
  parallelIndex = 0,
  totalParallel = 1,
}: EdgeGeometryParams): EdgeGeometryResult => {
  // Detect self-loop edge
  const isSelfLoop = sourceId === targetId;

  // Calculate node center positions
  const sourceCenterX = sourcePosition.x + NODE_RADIUS;
  const sourceCenterY = sourcePosition.y + NODE_RADIUS;
  const targetCenterX = targetPosition.x + NODE_RADIUS;
  const targetCenterY = targetPosition.y + NODE_RADIUS;

  // Generate self-loop path and label position
  const getSelfLoopPath = () => {
    // Position self-loop at top of node by default (-90 degrees / 12 o'clock)
    // Multiple self-loops spread across a wider arc to reduce overlap
    const baseAngle = -Math.PI / 2;
    const totalSpread = Math.min(Math.PI * 0.25, Math.PI / 2 + (totalParallel - 1) * 0.25); // Up to ~117 degrees
    const angleStep = totalParallel > 1 ? totalSpread / (totalParallel - 1) : 0;
    const loopAngle = baseAngle - totalSpread / 2 + parallelIndex * angleStep;

    // Connection radius from node center (where edge connects to node)
    const connectionRadius = NODE_RADIUS + EDGE_OFFSET;

    // Entry and exit points on node border with angular separation
    const entryAngle = loopAngle - SELF_LOOP_SPREAD / 2;
    const exitAngle = loopAngle + SELF_LOOP_SPREAD / 2;

    const entryX = sourceCenterX + Math.cos(entryAngle) * connectionRadius;
    const entryY = sourceCenterY + Math.sin(entryAngle) * connectionRadius;
    const exitX = sourceCenterX + Math.cos(exitAngle) * connectionRadius;
    const exitY = sourceCenterY + Math.sin(exitAngle) * connectionRadius;

    // Scale loop radius for multiple parallel self-loops
    const loopScale = 1 + parallelIndex * 0.6 + (totalParallel - 1) * 0.15;
    const scaledRadius = SELF_LOOP_RADIUS * loopScale;

    // Calculate control points for a smooth, visible loop
    // Control points spread wider than entry/exit for a rounder curve
    const controlSpread = 0.75; // Wider spread creates rounder loop
    const control1Angle = loopAngle - controlSpread;
    const control2Angle = loopAngle + controlSpread;

    // Control points extend outward from node center
    const controlDistance = connectionRadius + scaledRadius;
    const control1X = sourceCenterX + Math.cos(control1Angle) * controlDistance;
    const control1Y = sourceCenterY + Math.sin(control1Angle) * controlDistance;
    const control2X = sourceCenterX + Math.cos(control2Angle) * controlDistance;
    const control2Y = sourceCenterY + Math.sin(control2Angle) * controlDistance;

    // Label positioned at the apex of the loop
    const labelDistance = connectionRadius + scaledRadius * 0.5;

    return {
      path: `M ${entryX},${entryY} C ${control1X},${control1Y} ${control2X},${control2Y} ${exitX},${exitY}`,
      labelPos: {
        x: sourceCenterX + Math.cos(loopAngle) * labelDistance,
        y: sourceCenterY + Math.sin(loopAngle) * labelDistance,
      },
    };
  };

  // Calculate offset for parallel edges with auto-scaling spacing
  const getEdgeOffset = () => {
    if (totalParallel <= 1) return 0;

    // Auto-scale spacing based on number of parallel edges
    const baseSpacing = 60; // Reduced base spacing for tighter curves
    const spacingScale = Math.max(0.5, 1 - (totalParallel - 2) * 0.08);
    const spacing = baseSpacing * spacingScale;

    const totalOffset = (totalParallel - 1) * spacing;
    const offset = parallelIndex * spacing - totalOffset / 2;
    return offset;
  };

  const offset = getEdgeOffset();

  // Calculate angular spread for parallel edges to prevent arrow overlap
  const getAngularOffset = () => {
    if (totalParallel <= 1) return 0;

    // Increased angular spacing to prevent connection point clustering
    const baseAngleSpacing = 0.35; // ~20 degrees between parallel edges
    const angleScale = Math.max(0.5, 1 - (totalParallel - 2) * 0.05);
    const angleSpacing = baseAngleSpacing * angleScale;

    const totalSpread = (totalParallel - 1) * angleSpacing;
    return parallelIndex * angleSpacing - totalSpread / 2;
  };

  const angularOffset = getAngularOffset();

  // Calculate connection points with angular offset for parallel edges
  const getAdjustedIntersection = (
    centerX: number,
    centerY: number,
    targetX: number,
    targetY: number,
    angleOffset: number
  ) => {
    const dx = targetX - centerX;
    const dy = targetY - centerY;
    const baseAngle = Math.atan2(dy, dx);
    const adjustedAngle = baseAngle + angleOffset;

    const adjustedRadius = NODE_RADIUS + EDGE_OFFSET;

    return {
      x: centerX + Math.cos(adjustedAngle) * adjustedRadius,
      y: centerY + Math.sin(adjustedAngle) * adjustedRadius,
    };
  };

  // Calculate actual connection points with angular spread for parallel edges
  const sourceIntersection = getAdjustedIntersection(
    sourceCenterX,
    sourceCenterY,
    targetCenterX,
    targetCenterY,
    angularOffset
  );
  const targetIntersection = getAdjustedIntersection(
    targetCenterX,
    targetCenterY,
    sourceCenterX,
    sourceCenterY,
    -angularOffset
  );

  // Create cubic bezier path with floating connection points for smoother curves
  const getCubicBezierPath = () => {
    const startX = sourceIntersection.x;
    const startY = sourceIntersection.y;
    const endX = targetIntersection.x;
    const endY = targetIntersection.y;

    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      return `M ${startX},${startY} L ${endX},${endY}`;
    }

    // Perpendicular vector for curve offset
    const perpX = -dy / length;
    const perpY = dx / length;

    // Adaptive curve intensity based on edge distance
    const minCurveIntensity = 0.45; // Minimum curve for single edges
    const baseCurveIntensity = totalParallel > 1 ? 0.8 : minCurveIntensity;
    const distanceFactor = Math.min(1.2, length / 250);
    const curveIntensity = baseCurveIntensity * (1 + distanceFactor * 0.25);

    // Calculate control points for cubic bezier
    // Position them at 1/3 and 2/3 along the edge for smooth S-curve
    const oneThirdX = startX + dx / 3;
    const oneThirdY = startY + dy / 3;
    const twoThirdX = startX + (2 * dx) / 3;
    const twoThirdY = startY + (2 * dy) / 3;

    // Apply perpendicular offset to control points
    const controlOffset = offset * curveIntensity;
    const control1X = oneThirdX + perpX * controlOffset;
    const control1Y = oneThirdY + perpY * controlOffset;
    const control2X = twoThirdX + perpX * controlOffset;
    const control2Y = twoThirdY + perpY * controlOffset;

    // Cubic bezier: M start C control1 control2 end
    return `M ${startX},${startY} C ${control1X},${control1Y} ${control2X},${control2Y} ${endX},${endY}`;
  };

  // Calculate label position with staggering for parallel edges
  const getStaggeredLabelPosition = () => {
    const startX = sourceIntersection.x;
    const startY = sourceIntersection.y;
    const endX = targetIntersection.x;
    const endY = targetIntersection.y;

    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return { x: (startX + endX) / 2, y: (startY + endY) / 2 };

    // Perpendicular vector
    const perpX = -dy / length;
    const perpY = dx / length;

    // Stagger labels along the curve based on parallelIndex
    // Distribute t values between 0.3 and 0.7 for visibility
    const tRange = 0.08; // How much to stagger each edge
    const centerT = 0.5;
    const staggerOffset = (parallelIndex - (totalParallel - 1) / 2) * tRange;
    const t = Math.max(0.25, Math.min(0.75, centerT + staggerOffset));

    // Calculate control points (same as path calculation)
    const minCurveIntensity = 0.45;
    const baseCurveIntensity = totalParallel > 1 ? 0.8 : minCurveIntensity;
    const distanceFactor = Math.min(1.2, length / 250);
    const curveIntensity = baseCurveIntensity * (1 + distanceFactor * 0.25);

    const oneThirdX = startX + dx / 3;
    const oneThirdY = startY + dy / 3;
    const twoThirdX = startX + (2 * dx) / 3;
    const twoThirdY = startY + (2 * dy) / 3;

    const controlOffset = offset * curveIntensity;
    const control1X = oneThirdX + perpX * controlOffset;
    const control1Y = oneThirdY + perpY * controlOffset;
    const control2X = twoThirdX + perpX * controlOffset;
    const control2Y = twoThirdY + perpY * controlOffset;

    // Calculate point on cubic bezier at parameter t
    // B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
    const oneMinusT = 1 - t;
    const curveX =
      oneMinusT * oneMinusT * oneMinusT * startX +
      3 * oneMinusT * oneMinusT * t * control1X +
      3 * oneMinusT * t * t * control2X +
      t * t * t * endX;
    const curveY =
      oneMinusT * oneMinusT * oneMinusT * startY +
      3 * oneMinusT * oneMinusT * t * control1Y +
      3 * oneMinusT * t * t * control2Y +
      t * t * t * endY;

    // Label is positioned directly on the curve - no additional perpendicular offset needed
    // since the bezier control points already account for the edge's curve offset
    return { x: curveX, y: curveY };
  };

  // Get path and label position based on edge type
  const selfLoopData = isSelfLoop ? getSelfLoopPath() : null;
  const path = isSelfLoop ? selfLoopData!.path : getCubicBezierPath();
  const labelPos = isSelfLoop ? selfLoopData!.labelPos : getStaggeredLabelPosition();

  return { path, labelPos, isSelfLoop };
};

function CustomEdge({ id, source, target, data, selected }: EdgeProps) {
  const theme = useTheme();
  const edgeData = (data || {}) as CustomEdgeData;
  const { edgeTypeItem, isActive, parallelIndex = 0, totalParallel = 1 } = edgeData;
  const style = edgeTypeItem.style || {};

  const strokeColor = style.strokeColor || LINE_STYLE.stroke;
  const isSelected = selected || isActive;

  // Get node positions and selection state from React Flow store
  const sourceNode = useStore((store) => store.nodeLookup.get(source));
  const targetNode = useStore((store) => store.nodeLookup.get(target));

  // Check if either connected node is selected or being dragged
  const isSourceActive = sourceNode?.data?.isActive || false;
  const isTargetActive = targetNode?.data?.isActive || false;
  const isSourceSelected = sourceNode?.selected || false;
  const isTargetSelected = targetNode?.selected || false;
  const isSourceDragging = sourceNode?.dragging || false;
  const isTargetDragging = targetNode?.dragging || false;

  // Hide edge for large graph
  const edgesCount = useStore((state) => state.edges.length) || 0;
  const currentZoom = useStore((state) => state.panZoom?.getViewport().zoom) || 0;
  const zoomThreshold = edgesCount > 400 ? 0.3 : edgesCount > 800 ? 0.6 : edgesCount > 1200 ? 1 : 0;

  const isVisibleEdges = currentZoom > zoomThreshold;
  if (!isVisibleEdges) {
    return null;
  }

  // Elevate edge if it's selected OR if any connected node is selected/dragging
  const shouldHighlight = isSelected || isSourceActive || isTargetActive || isSourceDragging || isTargetDragging;
  const shouldElevate = shouldHighlight || isSourceSelected || isTargetSelected;

  if (!sourceNode || !targetNode) {
    return null;
  }

  // Detect self-loop edge
  const { path: edgePath, labelPos } = calculateEdgeGeometry({
    sourceId: source,
    targetId: target,
    sourcePosition: sourceNode.position,
    targetPosition: targetNode.position,
    parallelIndex,
    totalParallel,
  });

  // Determine marker style based on edge direction
  const getMarkers = () => {
    const direction = edgeTypeItem.direction;

    if (direction === EdgeDirectionType.Backward) {
      return {
        markerStart: 'url(#arrow-backward)',
        markerEnd: undefined,
      };
    } else if (direction === EdgeDirectionType.Undirected) {
      return {
        markerStart: undefined,
        markerEnd: undefined,
      };
    } else {
      return {
        markerStart: undefined,
        markerEnd: 'url(#arrow-forward)',
      };
    }
  };

  const markers = getMarkers();

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: shouldHighlight ? 2 : 1.6,
          opacity: shouldHighlight ? 1 : 0.8,
          zIndex: shouldElevate ? 999 : 0,
        }}
        markerEnd={markers.markerEnd}
        markerStart={markers.markerStart}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelPos.x}px, ${labelPos.y}px)`,
            backgroundColor: theme.palette.vesoft.v2.bg1,
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: isActive ? 700 : 400,
            color: theme.palette.vesoft.v2.text1,
            pointerEvents: 'all',
            whiteSpace: 'nowrap',
            zIndex: shouldElevate ? 1000 : 0,
            cursor: 'pointer',
            contentVisibility: 'auto',
          }}
          className="nodrag nopan"
        >
          {edgeTypeItem.name || '[Edge Name]'}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(CustomEdge);
