import { useTheme } from '@mui/material';
import { ConnectionLineComponentProps } from '@xyflow/react';

export function CustomConnectionLine({ fromX, fromY, toX, toY }: ConnectionLineComponentProps) {
  const theme = useTheme();

  return (
    <g>
      <path
        d={`M ${fromX},${fromY} L ${toX},${toY}`}
        stroke={theme.palette.vesoft.v2.text3}
        strokeWidth={2}
        fill="none"
        strokeDasharray="5,5"
      />
      <circle cx={toX} cy={toY} r={3} fill={theme.palette.vesoft.v2.text3} />
    </g>
  );
}
