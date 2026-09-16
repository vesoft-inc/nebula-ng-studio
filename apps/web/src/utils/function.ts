export const handleKeyword = (name: string) => {
  return `\`${handleEscape(name)}\``;
};

export const handleEscape = (name: string) => name.replace(/\\/gm, '\\\\').replace(/`/gm, '\\`');

export const removeNullCharacters = (data: string) => {
  return data.replace(/\u0000+$/, '');
};

export const safeParse = <T extends unknown>(
  data: string,
  options?: { paser?: (data: string) => T }
): T | undefined => {
  const { paser } = options || {};
  try {
    return paser ? paser(data) : JSON.parse(data);
  } catch (err) {
    console.error('JSON.parse error', err);
    return undefined;
  }
};

export const getByteLength = (str: string) => {
  const utf8Encode = new TextEncoder();
  return utf8Encode.encode(str).length;
};

export const isValidIP = (ip: string) => {
  const reg = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])(\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])){3}$/;
  return reg.test(ip);
};

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
