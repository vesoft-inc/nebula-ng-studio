export class LocalStorageUtil {
  static setItem<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  static getItem<T>(key: string): T | undefined {
    const item = localStorage.getItem(key);
    if (item) {
      return JSON.parse(item);
    }
    return;
  }

  static removeItem(key: string) {
    localStorage.removeItem(key);
  }
}
