import { Parser } from '@json2csv/plainjs';
import BigNumber from 'bignumber.js';

export const removeNullCharacters = (data: string) => {
  return data.replace(/\u0000+$/, '');
};

export const handleEscape = (name: string) => name.replace(/\\/gm, '\\\\').replace(/`/gm, '\\`');

export const handleKeyword = (name: string) => {
  return `\`${handleEscape(name || '')}\``;
};

// convert color from hex to rgba
export function hexToRgba(hex: string, alpha = 1): string {
  // 确保 alpha 值在 0 到 1 之间
  if (alpha < 0 || alpha > 1) {
    throw new Error('Alpha value must be between 0 and 1');
  }

  // 去掉前面的 # 号
  hex = hex.replace('#', '');

  // 将 3 位的十六进制颜色值转换为 6 位
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  // 提取 RGB 颜色值
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // 返回 RGBA 颜色值
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const downloadCSVFiles = <T>({ data, title }: { data: T[]; title: string }) => {
  try {
    const result = new Parser().parse(data);
    // Determine browser type
    if (
      (navigator.userAgent.indexOf('compatible') > -1 && navigator.userAgent.indexOf('MSIE') > -1) ||
      navigator.userAgent.indexOf('Edge') > -1
    ) {
      // IE10 or Edge browsers
      const BOM = '\uFEFF';
      const csvData = new Blob([BOM + result], { type: 'text/csv' });
      // @ts-ignore
      navigator.msSaveBlob?.(csvData, `test.csv`);
    } else {
      // Non-Internet Explorer
      const blob = new Blob(['\ufeff' + result], { type: 'text/csv;charset=utf-8;' });
      // Use the download property of the A tag to implement the download function
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${title}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (err) {
    alert(err);
  }
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

export const convertBigNumberToString = (value: string) => {
  // int precision length in nebula is longer than in javascript
  return BigNumber.isBigNumber(value) ? value.toString() : value;
};

export function groupArray<T>(arr: T[], groupSize: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / groupSize) }, function (_, i) {
    return arr.slice(i * groupSize, i * groupSize + groupSize);
  });
}
