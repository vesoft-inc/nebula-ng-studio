import { modalStore } from '@vesoft-inc/studio-ui-internal/modal';
import { themeStore } from '@vesoft-inc/studio-ui-internal/theme';
import { CommonStore } from './common';
import { registerCommonStore } from './authBridge';

export { modalStore, themeStore };

export const commonStore = new CommonStore();

registerCommonStore(commonStore);
