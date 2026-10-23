import { EXPLORER_DEFAULT_SETTINGS, ExplorerSettings } from '@studio/components/Settings/constants';
import { EXPLORER_APP_CONFIG_KEY, useRemoteSettings } from '@studio/components/Settings/hook';
import { useModal } from '@studio/stores/useModal';
import { useEffect } from 'react';

export const useExplorerSettings = ({
  enabled,
  username,
  onUpdate,
}: {
  enabled?: boolean;
  username?: string;
  onUpdate?: (
    fn: <T = ExplorerSettings['appConfigForm'] & ExplorerSettings['personalConfigForm']>(val: T) => T
  ) => void;
}) => {
  const { message } = useModal();

  const remoteAppConfigQuery = useRemoteSettings({
    settingId: EXPLORER_APP_CONFIG_KEY,
    defaultSettings: EXPLORER_DEFAULT_SETTINGS.appConfigForm,
    onUpsertFailed: () => {
      message.warning(`Failed to save config`);
    },
  });

  const remotePersonalConfigQuery = useRemoteSettings({
    settingId: username ? `${EXPLORER_APP_CONFIG_KEY}-${encodeURI(username)}` : undefined,
    defaultSettings: EXPLORER_DEFAULT_SETTINGS.personalConfigForm,
    onUpsertFailed: () => {
      message.warning(`Failed to save config`);
    },
  });
  useEffect(() => {
    if (enabled) {
      remoteAppConfigQuery.refresh();
      remotePersonalConfigQuery.refresh();
    }
  }, [enabled, remoteAppConfigQuery.refresh, remotePersonalConfigQuery.refresh]);

  // Cache to store
  useEffect(() => {
    if (remoteAppConfigQuery.settings) {
      onUpdate?.((prev) => ({
        ...prev,
        ...(remoteAppConfigQuery.settings as ExplorerSettings['appConfigForm']),
      }));
    }
  }, [remoteAppConfigQuery.settings]);
  useEffect(() => {
    if (remotePersonalConfigQuery.settings) {
      onUpdate?.((prev) => ({
        ...prev,
        ...(remotePersonalConfigQuery.settings as ExplorerSettings['personalConfigForm']),
      }));
    }
  }, [remotePersonalConfigQuery.settings]);

  return {
    remoteAppConfigQuery,
    remotePersonalConfigQuery,
  };
};
