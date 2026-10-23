import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { SettingsContent } from '../../shared/Settings/Content';
import { SettingsDrawer } from '../../shared/Settings/Drawer';
import { useModal } from '../../shared/useModal';
import { useExplorerStore } from '../context';

export default observer(function ExplorerSettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const controller = useExplorerStore();
  const { message } = useModal();
  useEffect(() => {
    if (open) void controller.loadSettings().catch(() => {});
  }, [open, controller]);
  return (
    <SettingsDrawer
      open={open}
      loading={controller.settingsLoading}
      onClose={() => {
        onClose();
        void controller.saveSettings()?.catch(() => {
          message.warning('Failed to save config');
        });
      }}
    >
      <SettingsContent
        initialData={controller.settingsGroups.appConfigForm}
        onChange={(value) => controller.setSettingsGroup('appConfigForm', value)}
      />
      <SettingsContent
        initialData={controller.settingsGroups.personalConfigForm}
        onChange={(value) => controller.setSettingsGroup('personalConfigForm', value)}
      />
    </SettingsDrawer>
  );
});
