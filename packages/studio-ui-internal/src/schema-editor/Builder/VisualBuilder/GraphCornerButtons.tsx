import ScaleBtns from '../../../shared/ScaleBtns/index';
import { ScaleBtnContainer } from './styles';
import { useTranslation } from 'react-i18next';
import type { CanvasStore } from './store';

export function GraphCornerButtons({
  canvas,
  isForceLayoutRunning,
  toggleSimulation,
  onZoomIn,
  onZoomOut,
}: {
  canvas: CanvasStore;
  isForceLayoutRunning: boolean;
  toggleSimulation: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const { t } = useTranslation(['graphtype']);

  return (
    <ScaleBtnContainer>
      <ScaleBtns
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onToggleScreen={() => canvas.toggleFullScreen()}
        isFullScreen={canvas.fullScreen}
        onToggleForce={toggleSimulation}
        isForceRunning={isForceLayoutRunning}
        forceTooltip={{
          start: t('startForceLayout', { ns: 'graphtype' }),
          stop: t('stopForceLayout', { ns: 'graphtype' }),
        }}
      />
    </ScaleBtnContainer>
  );
}
