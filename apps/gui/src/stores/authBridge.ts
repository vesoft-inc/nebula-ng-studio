import type { CommonStore } from './common';

let commonStore: CommonStore | undefined;

/** Lets the request layer reach the session store without importing it (that import cycles through fetcher). */
export const registerCommonStore = (store: CommonStore) => {
  commonStore = store;
};

export const clearSessionUser = () => {
  commonStore?.clearUserInfo();
};
