import { modalStore } from '@vesoft-inc/ui-components/modal';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { routerStore } from '@vesoft-inc/utils';
import { CommonStore } from './common';
import ConsoleStore from './console';
import { IconGroupStore } from './iconGroup';
import SchemaStore from './schema';
import { createSchemaServices } from '../services/schemaCatalog';

export { modalStore, routerStore, themeStore };

export const commonStore = new CommonStore();
export const schemaStore = new SchemaStore(createSchemaServices(() => commonStore.userInfo));
export const consoleStore = new ConsoleStore();
export const iconGroupStore = new IconGroupStore();

commonStore.attach({
  iconGroupStore,
  consoleStore,
  routerStore,
  schemaStore,
});

schemaStore.attach({ getCurrentSchemaPath: () => commonStore.userInfo?.curSchemaPath });
