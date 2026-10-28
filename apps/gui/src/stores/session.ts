import { modalStore } from '@vesoft-inc/ui-components/modal';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { CommonStore } from './common';
import { registerCommonStore } from './authBridge';

export { modalStore, themeStore };

export const commonStore = new CommonStore();

registerCommonStore(commonStore);
