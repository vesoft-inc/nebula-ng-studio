import ScaleBtns from '@studio/components/ScaleBtns';
import { ScaleBtnContainer } from './styles';
import { useTranslation } from 'react-i18next';
import { isFullScreen } from './store';

export function GraphCornerButtons({
  isForceLayoutRunning,
  toggleSimulation,
  onZoomIn,
  onZoomOut,
}: {
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
        onToggleScreen={() => isFullScreen.set(!isFullScreen.get())}
        isFullScreen={isFullScreen.get()}
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
