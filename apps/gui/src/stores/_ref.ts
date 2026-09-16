import type { RootStore } from './index';

const rootStoreRef = { current: undefined as unknown as RootStore };

export const getRootStore = () => rootStoreRef.current;

export const setRootStore = (store: RootStore) => {
  if (rootStoreRef.current) return;
  rootStoreRef.current = store;
};
