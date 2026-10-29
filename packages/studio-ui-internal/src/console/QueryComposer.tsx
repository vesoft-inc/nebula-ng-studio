import { Box, IconButton, Tooltip, useTheme } from '@mui/material';
import { Play, Stop } from '@vesoft-inc/icons';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import GqlEditor from '../editor/GqlEditor';
import { useConsole } from './context';

export interface QueryToolbarProps {
  running: boolean;
  stopping?: boolean;
  onRun: () => void;
  onStop?: () => void;
}
export function QueryToolbar({ running, stopping, onRun, onStop }: QueryToolbarProps) {
  const { t } = useTranslation('console');
  const theme = useTheme();
  const canStop = running && !!onStop;
  return (
    <Tooltip title={t(canStop ? 'stop' : 'run')} placement="left">
      <IconButton
        onClick={canStop ? onStop : onRun}
        disabled={stopping || (running && !canStop)}
        size="small"
        sx={{
          borderRadius: '50%',
          backgroundColor: canStop ? theme.palette.vesoft.v2.error2 : theme.palette.vesoft.themeColor1,
          color: theme.palette.common.white,
          '&:hover': { backgroundColor: canStop ? theme.palette.vesoft.v2.error3 : theme.palette.vesoft.themeColor2 },
        }}
      >
        {canStop ? <Stop sx={{ fontSize: 16 }} /> : <Play sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
}

export interface QueryComposerProps {
  maxHeight?: string;
  onRunGql?: () => void;
  onAfterRunGql?: () => void;
}
export default observer(function QueryComposer({ maxHeight, onRunGql, onAfterRunGql }: QueryComposerProps) {
  const { controller, settings, appearance } = useConsole();
  const run = async () => {
    if (controller.editorRunning || controller.stopping) return;
    onRunGql?.();
    await controller.runGql(controller.editorValue, { queryTimeout: (settings.queryTimeout ?? 0) * 1000 });
    onAfterRunGql?.();
  };
  return (
    <Box sx={{ position: 'relative', padding: '0 0 0 12px' }}>
      <GqlEditor
        value={controller.editorValue}
        onChange={controller.updateEditorValue}
        graphNames={controller.graphs.map((graph) => graph.graph)}
        autoHeight
        maxHeight={maxHeight}
        readOnly={controller.editorRunning || controller.stopping}
        prompt={appearance?.showPrompt === false ? undefined : `[${appearance?.prompt ?? 'nebula'}]>   `}
        onSubmit={run}
        onClear={() => controller.updateEditorValue('')}
        onReady={controller.setEditorRef}
        onRowCountChange={controller.updateEditorRowCount}
      />
      <Box
        sx={{
          position: 'absolute',
          top: controller.editorRowCount <= 2 ? 8 : 18,
          right: controller.editorRowCount <= 2 ? 8 : 18,
          zIndex: 999,
          transition: 'all 0.2s ease-in-out',
        }}
      >
        <QueryToolbar
          running={controller.editorRunning}
          stopping={controller.stopping}
          onRun={run}
          onStop={() => {
            void controller.cancelQuery().catch(console.error);
          }}
        />
      </Box>
    </Box>
  );
});
