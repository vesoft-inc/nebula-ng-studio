import type { ExplorerServices } from '@vesoft-inc/ui-components/explorer/model';
import { EXPLORER_DEFAULT_SETTINGS, type ExplorerSettings } from '@vesoft-inc/ui-components/settings';
import { execGql } from './nebula';
import { addSnapshot, deleteSnapshot, fetchSnapshots, getSnapshotDetail, updateSnapShot } from './explorer';
import { fetchGlobalConfig, upsertGlobalConfig } from './globalConfig';
import { EXPLORER_APP_CONFIG_KEY } from '@studio/components/Settings/hook';

export function createExplorerServices(username?: string): ExplorerServices {
  const personalKey = username ? `${EXPLORER_APP_CONFIG_KEY}-${encodeURI(username)}` : undefined;
  return {
    execute: execGql,
    snapshotVersion: process.env.VERSION,
    snapshots: {
      create: addSnapshot,
      delete: deleteSnapshot,
      list: fetchSnapshots,
      read: getSnapshotDetail,
      update: updateSnapShot,
    },
    settings: {
      load: async () => {
        const [app, personal] = await Promise.all([
          fetchGlobalConfig<ExplorerSettings['appConfigForm']>(EXPLORER_APP_CONFIG_KEY),
          personalKey ? fetchGlobalConfig<ExplorerSettings['personalConfigForm']>(personalKey) : null,
        ]);
        return {
          appConfigForm: { ...EXPLORER_DEFAULT_SETTINGS.appConfigForm, ...app },
          personalConfigForm: { ...EXPLORER_DEFAULT_SETTINGS.personalConfigForm, ...personal },
        };
      },
      save: async (settings) => {
        await Promise.all([
          upsertGlobalConfig(EXPLORER_APP_CONFIG_KEY, settings.appConfigForm),
          personalKey ? upsertGlobalConfig(personalKey, settings.personalConfigForm) : undefined,
        ]);
      },
    },
  };
}
