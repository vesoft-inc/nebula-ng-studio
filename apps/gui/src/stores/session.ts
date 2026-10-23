import { modalStore } from '@vesoft-inc/ui-components/modal';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { routerStore } from '@vesoft-inc/utils';
import { CommonStore } from './common';
import { registerCommonStore } from './authBridge';

export { modalStore, routerStore, themeStore };

export const commonStore = new CommonStore();

registerCommonStore(commonStore);
