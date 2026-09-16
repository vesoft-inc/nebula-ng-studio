import { SettingsContent } from '@studio/components/Settings';
import { useStore } from '@studio/stores';
import { SettingsDrawer } from '../../../components/Settings';
import { observer } from 'mobx-react-lite';
import { useExplorerSettings } from './hook';

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { commonStore, explorerStore } = useStore();

  const username = commonStore.userInfo?.username;

  const { remoteAppConfigQuery, remotePersonalConfigQuery } = useExplorerSettings({
    enabled: open,
    username,
    onUpdate: explorerStore.updateSettings.bind(explorerStore),
  });

  return (
    <>
      <SettingsDrawer
        open={open}
        onClose={() => {
          onClose();
          // sync to db
          if (remoteAppConfigQuery.settings) {
            remoteAppConfigQuery.upsert(remoteAppConfigQuery.settings);
          }
          if (remotePersonalConfigQuery.settings) {
            remotePersonalConfigQuery.upsert(remotePersonalConfigQuery.settings);
          }
        }}
        loading={remoteAppConfigQuery.isPending || remotePersonalConfigQuery.isPending || !username}
      >
        {!remoteAppConfigQuery.isPending && remoteAppConfigQuery.settings && (
          <SettingsContent initialData={remoteAppConfigQuery.settings} onChange={remoteAppConfigQuery.setSettings} />
        )}
        {!remotePersonalConfigQuery.isPending && remotePersonalConfigQuery.settings && (
          <SettingsContent
            initialData={remotePersonalConfigQuery.settings}
            onChange={remotePersonalConfigQuery.setSettings}
          />
        )}
      </SettingsDrawer>
    </>
  );
}

const observedDrawer = observer(Drawer);

export default observedDrawer;
