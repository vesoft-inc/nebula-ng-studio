import { useTheme } from '@mui/material';
import { LINE_STYLE } from '@vesoft-inc/utils';

function GraphMarkerDefinitions() {
  const theme = useTheme();
  const arrowColor = LINE_STYLE.stroke || theme.palette.vesoft.v2.text3;

  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {/* Forward arrow marker */}
        <marker id="arrow-forward" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={arrowColor} />
        </marker>

        {/* Backward arrow marker */}
        <marker
          id="arrow-backward"
          viewBox="0 0 10 10"
          refX="1"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 10 0 L 0 5 L 10 10 z" fill={arrowColor} />
        </marker>
      </defs>
    </svg>
  );
}

export default GraphMarkerDefinitions;
