import { useCallback, useEffect, useState } from 'react';
import { ConsoleSettingsForm, ExplorerSettingsForm } from './constants';
import { fetchGlobalConfig, upsertGlobalConfig } from '@studio/services/globalConfig';

/**
 * Local settings
 */

const STORAGE_KEY = 'console-settings';

type SettingForm = ConsoleSettingsForm | ExplorerSettingsForm;

const readStorageSettingsMap = <T = SettingForm>({
  storageKey = STORAGE_KEY,
  storageInstance,
}: {
  storageKey?: string;
  storageInstance: Storage;
}) => {
  try {
    return JSON.parse(storageInstance.getItem(storageKey) || '{}') as Record<string, T>;
  } catch (error) {
    return {};
  }
};

export const readStorageSettings = <T = SettingForm>(
  settingId: string,
  { storageInstance = localStorage }: { storageInstance?: Storage }
) => {
  const settingsMap = readStorageSettingsMap<T>({ storageInstance });
  const targetSettings = settingsMap[settingId as keyof typeof settingsMap];
  if (!targetSettings) {
    return null;
  }
  return targetSettings;
};

export const useStorageSettings = <T = SettingForm>({
  settingId,
  defaultSettings,
  storageKey = STORAGE_KEY,
  storageInstance = localStorage,
}: {
  settingId?: string | null;
  defaultSettings: T;
  storageKey?: string;
  storageInstance?: Storage;
}) => {
  const [isPending, setIsPending] = useState(false);

  const [, setSettingsMap] = useState(() => readStorageSettingsMap<T>({ storageInstance }));
  const [settings, setSettings] = useState<T>(defaultSettings);

  const upsertSettings = useCallback(
    (
      values: T,
      {
        onBeforeSaveInStorage,
      }: {
        onBeforeSaveInStorage?: (values: Record<string, T>, value: T) => Record<string, T>;
      } = {}
    ) => {
      setSettings(values);

      if (!settingId) {
        return;
      }

      // Sync to local storage
      setSettingsMap((prev) => {
        let latestSettingsMap = {
          ...prev,
          ...readStorageSettingsMap<T>({ storageInstance }),
          [settingId as keyof typeof prev]: values,
        };

        if (onBeforeSaveInStorage) {
          latestSettingsMap = onBeforeSaveInStorage(latestSettingsMap, values);
        }

        storageInstance.setItem(storageKey, JSON.stringify(latestSettingsMap));

        return latestSettingsMap;
      });
    },
    [settingId, storageInstance]
  );

  useEffect(() => {
    if (!settingId) {
      return;
    }

    setIsPending(true);
    const settingsMap = readStorageSettingsMap<T>({ storageInstance });
    const values = settingsMap[settingId as keyof typeof settingsMap];
    if (!values) {
      setIsPending(false);
      return;
    }

    upsertSettings(values as T);

    // Prevent batch update
    setTimeout(() => {
      setIsPending(false);
    }, 0);
  }, [settingId, upsertSettings, storageInstance]);

  return {
    settings,
    upsertSettings,
    isPending,
  };
};

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
