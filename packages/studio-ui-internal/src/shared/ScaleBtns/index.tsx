import { Tooltip } from '@mui/material';
import { ScaleButton, ScalesBtnContainer } from './styles';
import { AddFilled, Fullscreen, FullscreenExit, Minus, Pause, Play } from '@vesoft-inc/icons';

interface ZoomBtnsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onToggleScreen?: () => void;
  isFullScreen?: boolean;
  onToggleForce?: () => void;
  isForceRunning?: boolean;
  forceTooltip?: {
    start: string;
    stop: string;
  };
}

function ZoomBtns(props: ZoomBtnsProps) {
  const { onZoomIn, onZoomOut, onToggleScreen, isFullScreen, onToggleForce, isForceRunning, forceTooltip } = props;

  return (
    <ScalesBtnContainer>
      {onToggleForce && (
        <Tooltip title={isForceRunning ? forceTooltip?.stop : forceTooltip?.start} placement="left">
          <ScaleButton
            variant="outlined"
            sx={{
              bgcolor: (theme) => theme.palette.vesoft.v2.bg1,
              color: (theme) => (isForceRunning ? theme.palette.vesoft.v2.primary3 : theme.palette.vesoft.v2.text2),
            }}
            onClick={onToggleForce}
          >
            {isForceRunning ? <Pause fontSize="small" /> : <Play fontSize="medium" />}
          </ScaleButton>
        </Tooltip>
      )}

      <ScaleButton
        variant="outlined"
        sx={{
          bgcolor: (theme) => theme.palette.vesoft.v2.bg1,
        }}
        onMouseUp={onZoomIn}
      >
        <AddFilled fontSize="medium" />
      </ScaleButton>
      <ScaleButton
        variant="outlined"
        sx={{
          bgcolor: (theme) => theme.palette.vesoft.v2.bg1,
        }}
        onMouseUp={onZoomOut}
      >
        <Minus fontSize="medium" />
      </ScaleButton>
      <ScaleButton
        variant="outlined"
        sx={{
          bgcolor: (theme) => theme.palette.vesoft.v2.bg1,
        }}
        onClick={onToggleScreen}
      >
        {isFullScreen ? <FullscreenExit fontSize="medium" /> : <Fullscreen fontSize="medium" />}
      </ScaleButton>
    </ScalesBtnContainer>
  );
}
export default ZoomBtns;
