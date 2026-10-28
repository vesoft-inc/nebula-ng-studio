import { v4 as uuid } from 'uuid';
import defaultTo from 'lodash/defaultTo.js';

export const createUuid = (): string => uuid().replaceAll('-', '');

export function safeArray<T>(value: T[] | undefined | null): T[] {
  return defaultTo(value, [] as T[]);
}

export function groupArray<T>(arr: T[], groupSize: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / groupSize) }, function (_, i) {
    return arr.slice(i * groupSize, i * groupSize + groupSize);
  });
}

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
