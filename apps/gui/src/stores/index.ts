import { createContext, useContext } from 'react';
import { RouterStore } from '@vesoft-inc/utils';
import { ModalStore } from '@vesoft-inc/ui-components/modal';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { setRootStore, getRootStore } from './_ref';
import { CommonStore } from './common';

export class RootStore {
  modalStore = new ModalStore();
  commonStore = new CommonStore();
  routerStore = new RouterStore();
  themeStore = themeStore;
}

const rootStore = new RootStore();

setRootStore(rootStore);

// @ts-ignore
window.guiStore = rootStore;

export { getRootStore };
export const storeContext = createContext(rootStore);
export const StoreProvider = storeContext.Provider;
export function useStore() {
  const store = useContext(storeContext);
  return store;
}
