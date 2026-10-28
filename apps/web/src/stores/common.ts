import { computed, makeAutoObservable, observable } from 'mobx';
import i18n, { Language } from '@studio/utils/i18n';
import { connect, disconnect, fetchUserInfo, oauth2Connect } from '@studio/services';
import { IUserInfo } from '@vesoft-inc/ui-components/schema/types';
import { LANG_KEY } from '@studio/utils/constant';
import { LocalStorageUtil } from '@vesoft-inc/studio-core/browser';
import { brandConfig } from '@studio/utils';
import { encrypt } from '@vesoft-inc/studio-core/crypto';
import { sessionRequests } from '@studio/services/sessionRequests';

export class CommonStore {
  dbName = brandConfig.consoleName;
  prodName = 'Studio';
  hasDarkMode = true;

  deps?: {
    iconGroupStore: { clear: () => void };
    consoleStore: { clearConsole: () => void };
    schemaStore: { reset: () => void };
    clearOverlays?: () => void;
    onLogout: (redirectUrl?: string) => void;
  };
  sessionStatus: 'idle' | 'checking' | 'authenticated' | 'anonymous' = 'idle';
  sessionRevision = 0;
  private initialization?: Promise<boolean>;
  language = i18n.language;

  i18n = i18n;

  userInfo?: IUserInfo;

  constructor() {
    makeAutoObservable<this, 'initialization'>(this, {
      // observables
      deps: false,
      initialization: false,
      userInfo: observable.ref,
      // computed
      isEnLang: computed,
      isLogin: computed,

      // actions, beging with 'set', 'add', 'delete', etc.
      changeLanguage: false,
      login: false,
    });
    i18n.on('languageChanged', this.setLanguage);
  }

  get isEnLang() {
    return this.language === Language.EN_US;
  }

  get isLogin() {
    return !!this.userInfo;
  }

  initializeSession = (): Promise<boolean> => {
    if (this.isLogin) return Promise.resolve(true);
    if (this.initialization) return this.initialization;
    if (this.sessionStatus === 'anonymous') return Promise.resolve(false);
    this.sessionStatus = 'checking';
    const pending = this.getUserInfo().finally(() => {
      if (this.initialization === pending) this.initialization = undefined;
    });
    this.initialization = pending;
    return pending;
  };

  setLanguage = (lng: string) => {
    LocalStorageUtil.setItem(LANG_KEY, lng);
    this.language = lng;
  };

  changeLanguage = (lng: Language) => {
    i18n.changeLanguage(lng);
  };

  login = async (payload: { address: string; port: string; username: string; password: string }) => {
    this.invalidateSession();
    const revision = this.sessionRevision;
    const { port, username, password } = payload;
    const address = payload.address.trim().replace(/^https?:\/\//, '');

    const authorization = await encrypt(JSON.stringify([username, password]));
    if (revision !== this.sessionRevision) return false;

    const { code } = await connect(
      { address: `${address}:${+port}` },
      { headers: { Authorization: `Bearer ${authorization}` } }
    );
    if (revision !== this.sessionRevision || code !== 0) return false;
    return this.getUserInfo();
  };

  oauth2Login = async (payload: { address: string; port: string }) => {
    this.invalidateSession();
    const revision = this.sessionRevision;
    const address = payload.address.trim().replace(/^https?:\/\//, '');
    const { code, data } = await oauth2Connect({ address: `${address}:${+payload.port}` });
    if (revision === this.sessionRevision && code === 0 && data?.redirect) {
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
    const revision = this.sessionRevision;
    const res = await disconnect();
    if (revision === this.sessionRevision && res.code === 0) {
      this.invalidateSession();
      this.deps?.onLogout(res.data?.data.redirectUrl);
    }
  };

  invalidateSession = () => {
    this.sessionRevision += 1;
    this.initialization = undefined;
    sessionRequests.reset();
    this.userInfo = undefined;
    this.sessionStatus = 'anonymous';
    this.explorerDestroy?.();
    this.explorerDestroy = undefined;
    this.deps?.iconGroupStore.clear();
    this.deps?.consoleStore.clearConsole();
    this.deps?.schemaStore.reset();
    this.deps?.clearOverlays?.();
  };

  setUserInfo = (userInfo?: IUserInfo) => {
    if (!userInfo) {
      this.invalidateSession();
      return;
    }
    if (this.userInfo && (this.userInfo.address !== userInfo.address || this.userInfo.username !== userInfo.username)) {
      this.invalidateSession();
    } else if (this.userInfo && this.userInfo.curSchemaPath !== userInfo.curSchemaPath) {
      this.deps?.consoleStore.clearConsole();
    }
    this.userInfo = userInfo;
    this.sessionStatus = 'authenticated';
  };

  setSchemaPath = (path: string) => {
    if (this.userInfo) this.setUserInfo({ ...this.userInfo, curSchemaPath: path });
  };

  getUserInfo = async () => {
    const revision = this.sessionRevision;
    try {
      const res = await fetchUserInfo();
      if (revision !== this.sessionRevision) return false;
      if (res.code === 0 && res.data) {
        this.setUserInfo(res.data);
        return true;
      }
    } catch {
      // Transport errors are reported by the request layer; protected pages stay unmounted.
    }
    if (revision === this.sessionRevision) this.invalidateSession();
    return false;
  };
}
