import { useCallback, useEffect, useRef, useState } from 'react';
import { ConsoleSettingsForm, ExplorerSettingsForm } from './constants';

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
  { storageInstance = localStorage, storageKey = STORAGE_KEY }: { storageInstance?: Storage; storageKey?: string }
) => {
  const settingsMap = readStorageSettingsMap<T>({ storageInstance, storageKey });
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

  const [settings, setSettings] = useState<T>(defaultSettings);
  const defaults = useRef(defaultSettings);
  defaults.current = defaultSettings;

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
      let latestSettingsMap = {
        ...readStorageSettingsMap<T>({ storageInstance, storageKey }),
        [settingId]: values,
      };
      if (onBeforeSaveInStorage) latestSettingsMap = onBeforeSaveInStorage(latestSettingsMap, values);
      storageInstance.setItem(storageKey, JSON.stringify(latestSettingsMap));
    },
    [settingId, storageInstance, storageKey]
  );

  useEffect(() => {
    if (!settingId) {
      setSettings(defaults.current);
      setIsPending(false);
      return;
    }

    setIsPending(true);
    const settingsMap = readStorageSettingsMap<T>({ storageInstance, storageKey });
    const values = settingsMap[settingId as keyof typeof settingsMap];
    if (!values) {
      setSettings(defaults.current);
      setIsPending(false);
      return;
    }

    upsertSettings(values as T);

    // Prevent batch update
    const timer = setTimeout(() => {
      setIsPending(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [settingId, upsertSettings, storageInstance, storageKey]);

  return {
    settings,
    upsertSettings,
    isPending,
  };
};
