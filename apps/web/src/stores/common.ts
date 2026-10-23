import { computed, makeAutoObservable, observable } from 'mobx';
import i18n, { Language } from '@studio/utils/i18n';
import { connect, disconnect, fetchUserInfo, oauth2Connect } from '@studio/services';
import { IUserInfo } from '@studio/interfaces';
import { LANG_KEY } from '@studio/utils/constant';
import { LocalStorageUtil } from '@studio/utils/function';
import { brandConfig, isGuiTarget } from '@studio/utils';
import { encrypt } from '@vesoft-inc/utils';

export class CommonStore {
  dbName = brandConfig.consoleName;
  prodName = 'Studio';
  hasDarkMode = true;

  deps?: {
    iconGroupStore: { clear: () => void };
    consoleStore: { clearConsole: () => void };
    routerStore: { replace: (to: string) => void };
    schemaStore: { reset: () => void };
  };
  loading = false;
  language = i18n.language;

  i18n = i18n;

  userInfo?: IUserInfo;

  constructor() {
    makeAutoObservable(this, {
      // observables
      deps: false,
      userInfo: observable.ref,
      // computed
      isEnLang: computed,
      isLogin: computed,

      // actions, beging with 'set', 'add', 'delete', etc.
      changeLanguage: false,
      login: false,
    });
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

  attach = (deps: NonNullable<CommonStore['deps']>) => {
    this.deps = deps;
  };

  private explorerDestroy?: () => void;

  registerExplorerDestroy = (destroy: () => void) => {
    this.explorerDestroy = destroy;
    return () => {
      if (this.explorerDestroy === destroy) {
        this.explorerDestroy = undefined;
      }
    };
  };

  logout = async () => {
    const res = await disconnect();
    if (res.code === 0) {
      this.explorerDestroy?.();
      this.deps?.iconGroupStore.clear();
      this.setUserInfo(undefined);
      this.deps?.consoleStore.clearConsole();
      this.deps?.schemaStore.reset();
      if (res.data?.data.redirectUrl) {
        window.location.replace(`${window.location.protocol}//${res.data?.data.redirectUrl}`);
        return;
      }
      this.deps?.routerStore.replace('/login');
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
