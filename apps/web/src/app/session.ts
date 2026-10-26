import { modalStore } from '@vesoft-inc/ui-components/modal';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { routerStore } from '@vesoft-inc/utils';
import { CommonStore } from '@studio/stores/common';
import ConsoleStore from '@studio/stores/console';
import { IconGroupStore } from '@studio/stores/iconGroup';
import { SchemaController } from '@vesoft-inc/ui-components/schema/model';
import { createSchemaServices } from '@studio/services/schemaCatalog';
import { sessionRequests } from '@studio/services/sessionRequests';
import { loginPath, toAppPath, toBrowserPath } from './paths';

export { modalStore, routerStore, themeStore };

export const commonStore = new CommonStore();
export const schemaStore = new SchemaController(createSchemaServices(() => commonStore.userInfo));
export const consoleStore = new ConsoleStore();
export const iconGroupStore = new IconGroupStore();

function navigateToLogin(restoreLocation: boolean) {
  const { pathname, search, hash } = window.location;
  const basename = window.APP_CONFIG?.basePath;
  const returnTo = toAppPath(`${pathname}${search}${hash}`, basename);
  // A failed connection attempt on Login must retain its original return location.
  if (restoreLocation && /^\/login\/?(?:[?#]|$)/i.test(returnTo)) return;
  const path = loginPath(restoreLocation ? returnTo : undefined);
  if (routerStore.router) void routerStore.replace(path);
  else window.location.replace(toBrowserPath(path, basename));
}

commonStore.attach({
  iconGroupStore,
  consoleStore,
  schemaStore,
  clearOverlays: () => {
    modalStore.hide();
    modalStore.message.clear();
  },
  onLogout: (redirectUrl) => {
    if (redirectUrl) window.location.replace(`${window.location.protocol}//${redirectUrl}`);
    else navigateToLogin(false);
  },
});
schemaStore.attach({ getCurrentSchemaPath: () => commonStore.userInfo?.curSchemaPath });

/** Installed by the application bootstrap, with the same lifetime as its router. */
export function bindSessionLifecycle() {
  return sessionRequests.subscribe(() => {
    commonStore.invalidateSession();
    navigateToLogin(true);
  });
}
