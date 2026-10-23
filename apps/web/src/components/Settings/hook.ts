import { useCallback, useState } from 'react';
import type { ExplorerSettingsForm } from './constants';
import { fetchGlobalConfig, upsertGlobalConfig } from '@studio/services/globalConfig';
export { readStorageSettings, useStorageSettings } from '@vesoft-inc/ui-components/settings';

/**
 * Remote settings for explorer
 */

export const EXPLORER_APP_CONFIG_KEY = 'explorer-app-config-v1';

const fetchAppConfig = (configKey: string): Promise<ExplorerSettingsForm | null> =>
  fetchGlobalConfig<ExplorerSettingsForm>(configKey);

const upsertAppConfig = (configKey: string, data: ExplorerSettingsForm) => upsertGlobalConfig(configKey, data);

export const useRemoteSettings = ({
  settingId,
  defaultSettings,
  onUpsertFailed,
}: {
  settingId?: string | null;
  defaultSettings?: ExplorerSettingsForm;
  onUpsertFailed?: (error: Error) => void;
}) => {
  const [isPending, setIsPending] = useState(false);
  const [settings, setSettings] = useState<typeof defaultSettings>(defaultSettings);

  const [savedSettings, setSavedSettings] = useState<typeof defaultSettings>(defaultSettings);

  const refresh = useCallback(async () => {
    if (!settingId) {
      return;
    }
    setIsPending(true);
    const data = await fetchAppConfig(settingId).finally(() => {
      setIsPending(false);
    });
    if (data) {
      setSettings({ ...defaultSettings, ...data });
      setSavedSettings({ ...defaultSettings, ...data });
    }
    return data;
  }, [settingId]);

  const upsert = useCallback(
    async (nextSettings: ExplorerSettingsForm) => {
      if (!settingId) {
        return;
      }
      // Filter out the same settings
      if (JSON.stringify(savedSettings) === JSON.stringify(nextSettings)) {
        return;
      }

      setIsPending(true);
      const res = await upsertAppConfig(settingId, nextSettings)
        .catch((err) => {
          console.error(err);
          onUpsertFailed?.(err);
        })
        .finally(() => {
          setIsPending(false);
        });

      setSavedSettings(nextSettings);

      return res?.value;
    },
    [settingId, onUpsertFailed, savedSettings]
  );

  return {
    isPending,
    settings,
    setSettings,
    refresh,
    upsert,
  };
};
