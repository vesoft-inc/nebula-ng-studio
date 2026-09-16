import { computed, makeAutoObservable, observable } from 'mobx';
import i18n, { Language } from '@studio/utils/i18n';
import { connect, disconnect, fetchUserInfo, oauth2Connect } from '@studio/services';
import { type RootStore } from '.';
import { IUserInfo } from '@studio/interfaces';
import { LANG_KEY } from '@studio/utils/constant';
import { LocalStorageUtil } from '@studio/utils/function';
import { brandConfig, isGuiTarget } from '@studio/utils';
import { encrypt } from '@vesoft-inc/utils';

export class CommonStore {
  dbName = brandConfig.consoleName;
  prodName = 'Studio';
  hasDarkMode = true;

  rootStore?: RootStore;
  loading = false;
  language = i18n.language;

  i18n = i18n;

  userInfo?: IUserInfo;

  constructor(rootStore?: RootStore) {
    makeAutoObservable(this, {
      // observables
      rootStore: observable.ref,
      userInfo: observable.ref,
      // computed
      isEnLang: computed,
      isLogin: computed,

      // actions, beging with 'set', 'add', 'delete', etc.
      changeLanguage: false,
      login: false,
    });
    this.rootStore = rootStore;
    this.authValidation();
    i18n.on('languageChanged', this.setLanguage);
  }

  get isEnLang() {
    return this.language === Language.EN_US;
  }

  get isLogin() {
    return !!this.userInfo;
  }

  authValidation = async () => {
    if (isGuiTarget) return;
    const { pathname } = window.location;
    if (!pathname.includes('/login')) {
      this.getUserInfo();
    }
  };

  setLoading = (loading: boolean) => {
    this.loading = loading;
  };

  setLanguage = (lng: string) => {
    LocalStorageUtil.setItem(LANG_KEY, lng);
    this.language = lng;
  };

  changeLanguage = (lng: Language) => {
    i18n.changeLanguage(lng);
  };

  // setLoginInfo = (host: string, username: string) => {
  //   this.host = host;
  //   this.username = username;
  // };

  login = async (payload: { address: string; port: string; username: string; password: string }) => {
    const { port, username, password } = payload;
    const address = payload.address.trim().replace(/^https?:\/\//, '');

    const authorization = await encrypt(JSON.stringify([username, password]));

    const { code } = await connect(
      { address: `${address}:${+port}` },
      { headers: { Authorization: `Bearer ${authorization}` } }
    );
    const success = code === 0;
    if (success) {
      await this.getUserInfo();
    }

    return success;
  };

  oauth2Login = async (payload: { address: string; port: string }) => {
    const address = payload.address.trim().replace(/^https?:\/\//, '');
    const { code, data } = await oauth2Connect({ address: `${address}:${+payload.port}` });
    if (code === 0 && data?.redirect) {
      window.location.href = data.redirect;
      return true;
    }
    return false;
  };

  logout = async () => {
    const res = await disconnect();
    if (res.code === 0) {
      this.rootStore?.explorerStore.destroy();
      this.rootStore?.iconGroupStore.clear();
      this.setUserInfo(undefined);
      this.rootStore?.consoleStore.clearConsole();
      if (res.data?.data.redirectUrl) {
        window.location.replace(`${window.location.protocol}//${res.data?.data.redirectUrl}`);
        return;
      }
      this.rootStore?.routerStore.replace('/login');
    }
  };

  setUserInfo = (userInfo?: IUserInfo) => {
    this.userInfo = userInfo;
  };

  getUserInfo = async () => {
    const res = await fetchUserInfo();
    const success = res.code === 0;
    if (success) {
      this.setUserInfo(res.data);
    }
    return success;
  };
}
