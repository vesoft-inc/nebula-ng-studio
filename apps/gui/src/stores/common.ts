import { consoleStore } from './console';
import { computed, makeAutoObservable, observable } from 'mobx';
import i18n, { Language } from '../utils/i18n';
import { IUserInfo } from '@vesoft-inc/ui-components/schema/types';
import { LANG_KEY } from '@gui/utils/preferences';
import { LocalStorageUtil } from '@vesoft-inc/utils';
import { clearToken, setToken } from '../utils/auth';
import { connect, disconnect, fetchUserInfo } from '../services';
import { brandConfig } from '@gui/utils/brand';
export class CommonStore {
  dbName = brandConfig.consoleName;
  prodName = 'GUI';
  hasDarkMode = true;
  language = i18n.language;

  i18n = i18n;
  userInfo?: IUserInfo;
  showLoginModal = false;
  isGettingUserInfo = false;

  constructor() {
    makeAutoObservable(this, {
      userInfo: observable.ref,
      isEnLang: computed,
      isGettingUserInfo: observable,
    });
    i18n.on('languageChanged', this.setLanguage);
  }

  get isEnLang() {
    return this.language === Language.EN_US;
  }

  setLanguage = (lng: string) => {
    this.language = lng;
  };

  changeLanguage = (lng: Language) => {
    LocalStorageUtil.setItem(LANG_KEY, lng);
    i18n.changeLanguage(lng);
  };

  login = async (payload: { address: string; port: string; username: string; password: string }): Promise<boolean> => {
    const { username, password } = payload;
    const res = await connect({ username, password });
    const data = res.data as unknown as { token: string };
    setToken(data.token);
    await this.getUserInfo();
    this.toggleLoginModal(false);
    return true;
  };

  oauth2Login = async (_payload: { address: string; port: string }): Promise<boolean> => false;

  logout = async () => {
    await disconnect();
    this.clearUserInfo();

    return;
  };

  clearUserInfo = () => {
    consoleStore.clearConsole();
    clearToken();
    this.setUserInfo(undefined);
    this.toggleLoginModal(true);
  };

  getUserInfo = async () => {
    if (this.isGettingUserInfo) {
      return;
    }

    try {
      this.isGettingUserInfo = true;
      const res = await fetchUserInfo();
      this.setUserInfo({
        ...res,
      });
    } finally {
      this.isGettingUserInfo = false;
    }
  };

  setUserInfo = (userInfo?: IUserInfo) => {
    this.userInfo = userInfo;
  };

  toggleLoginModal = (show: boolean) => {
    this.showLoginModal = show;
  };
}

export default CommonStore;
