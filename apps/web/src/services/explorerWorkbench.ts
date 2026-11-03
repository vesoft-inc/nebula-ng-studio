import type { ExplorerServices } from '@vesoft-inc/studio-ui-internal/explorer/model';
import { EXPLORER_DEFAULT_SETTINGS } from '@vesoft-inc/studio-ui-internal/settings';
import { createStudioServerExplorerServices } from '@vesoft-inc/studio-ui/adapters/studio-server';
import { execGql } from './nebula';
import { fetcher, backgroundFetcher } from './fetcher';
import { inSession, sessionRequests } from './sessionRequests';
import { EXPLORER_APP_CONFIG_KEY } from '@studio/app/settings';

export function createExplorerServices(username?: string): ExplorerServices {
  const personalKey = username ? `${EXPLORER_APP_CONFIG_KEY}-${encodeURI(username)}` : undefined;
  const signal = sessionRequests.signal;
  const base = createStudioServerExplorerServices({
    http: fetcher,
    backgroundHttp: backgroundFetcher,
    snapshotVersion: process.env.VERSION,
    settings: { appKey: EXPLORER_APP_CONFIG_KEY, personalKey },
  });
  return {
    execute: (gql, options) => inSession(signal, options, (request) => execGql(gql, request)),
    snapshotVersion: process.env.VERSION,
    snapshots: {
      create: (value) => inSession(signal, undefined, (request) => base.snapshots.create(value, request)),
      delete: (id) => inSession(signal, undefined, (request) => base.snapshots.delete(id, request)),
      list: (filter, options) => inSession(signal, options, (request) => base.snapshots.list(filter, request)),
      read: (id, options) => inSession(signal, options, (request) => base.snapshots.read(id, request)),
      update: (value) => inSession(signal, undefined, (request) => base.snapshots.update(value, request)),
    },
    settings: {
      load: async () => {
        const settings = await inSession(signal, undefined, (request) => base.settings!.load(request));
        return {
          appConfigForm: { ...EXPLORER_DEFAULT_SETTINGS.appConfigForm, ...settings.appConfigForm },
          personalConfigForm: { ...EXPLORER_DEFAULT_SETTINGS.personalConfigForm, ...settings.personalConfigForm },
        };
      },
      save: async (settings) => {
        await inSession(signal, undefined, (request) => base.settings!.save(settings, request));
      },
    },
  };
}
