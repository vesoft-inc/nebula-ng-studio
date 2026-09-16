import { createContext, useContext } from 'react';
import { RouterStore } from '@vesoft-inc/utils';
import { ModalStore } from '@vesoft-inc/ui-components/modal';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { setRootStore, getRootStore } from './_ref';
import { CommonStore } from './common';
import GraphTypeStore from './graphtype';
import ConsoleStore from './console';
import SchemaStore from './schema';
import { isGuiTarget } from '@studio/utils';
import { CommonStore as GuiCommonStore } from '@gui/stores/common';
import { ExplorerStore } from './explorer';
import { IconGroupStore } from './iconGroup';
import { EXPLORER_DEFAULT_SETTINGS } from '@studio/components/Settings/constants';

themeStore.updateThemeOptions({
  components: {
    MuiSvgIcon: {
      defaultProps: {
        fontSize: 'small',
      },
    },
    MuiTypography: {
      defaultProps: {
        fontWeight: 400,
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          height: 28,
        },
      },
    },
  },
});
export class RootStore {
  commonStore = isGuiTarget ? new GuiCommonStore(this) : new CommonStore(this);
  // commonStore = new CommonStore(this);
  routerStore = new RouterStore();
  graphtypeStore = new GraphTypeStore(this);
  themeStore = themeStore;
  modalStore = new ModalStore();
  schemaStore = new SchemaStore(this);
  consoleStore = new ConsoleStore(this);
  explorerStore = new ExplorerStore({
    rootStore: this,
    settings: {
      ...EXPLORER_DEFAULT_SETTINGS.appConfigForm,
      ...EXPLORER_DEFAULT_SETTINGS.personalConfigForm,
    },
  });
  iconGroupStore = new IconGroupStore();
}

const rootStore = new RootStore();

setRootStore(rootStore);

// @ts-ignore
window.studioStore = rootStore;

export { getRootStore };
export const storeContext = createContext(rootStore);
export const StoreProvider = storeContext.Provider;
export function useStore() {
  const store = useContext(storeContext);
  return store;
}
export function useModal() {
  const store = useStore();
  return store.modalStore;
}
