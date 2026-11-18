import { modalStore } from '@vesoft-inc/studio-ui-internal/modal';
import { themeStore } from '@vesoft-inc/studio-ui-internal/theme';
import { CommonStore } from '@studio/stores/common';
import { ConsoleController } from '@vesoft-inc/studio-ui-internal/console/model';
import { IconCatalog } from '@vesoft-inc/studio-ui-internal/graph/resources';
import { SchemaController } from '@vesoft-inc/studio-ui-internal/schema/model';
import { execConsoleGql, execGql } from '@studio/services';
import { studioIconServices } from '@studio/services/explorer';
import { createSchemaServices } from '@studio/services/schemaCatalog';
import { sessionRequests } from '@studio/services/sessionRequests';
import { StudioServerAdapters } from '@studio/services/studioServer';
import { loginPath, toAppPath, toBrowserPath } from './paths';

export { modalStore, themeStore };

export const commonStore = new CommonStore();
export const studioServerAdapters = new StudioServerAdapters();
export const schemaStore = new SchemaController(createSchemaServices(() => commonStore.userInfo, studioServerAdapters));
export const consoleStore = new ConsoleController({ execute: execConsoleGql, query: execGql });
export const iconGroupStore = new IconCatalog(studioIconServices);

function navigateToLogin(restoreLocation: boolean, navigate?: (path: string) => void) {
  const { pathname, search, hash } = window.location;
  const basename = window.APP_CONFIG?.basePath;
  const returnTo = toAppPath(`${pathname}${search}${hash}`, basename);
  // A failed connection attempt on Login must retain its original return location.
  if (restoreLocation && /^\/login\/?(?:[?#]|$)/i.test(returnTo)) return;
  const path = loginPath(restoreLocation ? returnTo : undefined);
  if (navigate) navigate(path);
  else window.location.replace(toBrowserPath(path, basename));
}

function handleLogout(redirectUrl?: string, navigate?: (path: string) => void) {
  if (redirectUrl) window.location.replace(`${window.location.protocol}//${redirectUrl}`);
  else navigateToLogin(false, navigate);
}

const sessionDependencies: NonNullable<CommonStore['deps']> = {
  iconGroupStore,
  consoleStore,
  schemaStore,
  resetServiceAdapters: studioServerAdapters.reset,
  clearOverlays: () => {
    modalStore.hide();
    modalStore.message.clear();
  },
  onLogout: handleLogout,
};
commonStore.attach(sessionDependencies);
schemaStore.attach({ getCurrentSchemaPath: () => commonStore.userInfo?.curSchemaPath });

/** Installed by the application bootstrap, with the same lifetime as its router. */
export function bindSessionLifecycle(navigate: (path: string) => void) {
  const dependencies = {
    ...sessionDependencies,
    onLogout: (redirectUrl?: string) => handleLogout(redirectUrl, navigate),
  };
  commonStore.attach(dependencies);
  const unsubscribe = sessionRequests.subscribe(() => {
    commonStore.invalidateSession();
    navigateToLogin(true, navigate);
  });
  return () => {
    unsubscribe();
    if (commonStore.deps === dependencies) commonStore.attach(sessionDependencies);
  };
}
