import { modalStore } from '@vesoft-inc/ui-components/modal';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { routerStore } from '@vesoft-inc/utils';
import { CommonStore as GuiCommonStore } from '@gui/stores/common';
import { isGuiTarget } from '@studio/utils';
import { CommonStore } from './common';
import ConsoleStore from './console';
import { IconGroupStore } from './iconGroup';
import SchemaStore from './schema';

export { modalStore, routerStore, themeStore };

export const commonStore = isGuiTarget ? new GuiCommonStore() : new CommonStore();
export const schemaStore = new SchemaStore();
export const consoleStore = new ConsoleStore();
export const iconGroupStore = new IconGroupStore();

if (commonStore instanceof CommonStore) {
  commonStore.attach({
    iconGroupStore,
    consoleStore,
    routerStore,
    schemaStore,
  });
}

schemaStore.attach({ commonStore });
