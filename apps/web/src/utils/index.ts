import { type Theme } from '@mui/material/styles';
import { v4 as uuid } from 'uuid';
import JSONBigInt from 'json-bigint';
import { cloneDeep, isEqual, isObject, throttle, unset } from 'lodash';
import dayjs from 'dayjs';
import durationPlugin from 'dayjs/plugin/duration';
import {
  BackwardEdgePattern,
  EdgeDirectionType,
  ForwardEdgePattern,
  getGraphEdgeId,
  UndirectedEdgePattern,
} from '@vesoft-inc/utils';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

dayjs.extend(durationPlugin);

import { AppTarget, DEFAULT_SCHEMA_PATH } from '@studio/utils/constant';
import { EdgeValue, GraphEdgeValue, GraphNodeValue, PathValue, VertexValue } from '@studio/interfaces/console';
import { NODE_SIZE } from './explorer';

export const safeParse = <T = unknown>(json: string): [T?, Error?] => {
  try {
    return [JSON.parse(json)];
  } catch (e) {
    return [undefined, e as Error];
  }
};

export const isType = <T>(value: unknown, type: string): value is T => {
  const typeString = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
  return typeString === type.toLowerCase();
};

export const getDuplicateValues = <T>(values: T[], key?: keyof T): T[] => {
  const duplicateValues = values.filter((value, index) => {
    if (key) {
      return values.findIndex((v) => v[key] === value) !== index;
    }
    return values.indexOf(value) !== index;
  });
  return duplicateValues;
};

export const getLabelColor = (index: number, theme: Theme): [string, string] => {
  const colors = [
    theme.palette.vesoft.status1,
    theme.palette.vesoft.status2,
    theme.palette.vesoft.status3,
    theme.palette.vesoft.status4,
    theme.palette.vesoft.status5,
  ];
  const bgColor = [
    theme.palette.vesoft.status1Bg,
    theme.palette.vesoft.status2Bg,
    theme.palette.vesoft.status3Bg,
    theme.palette.vesoft.status4Bg,
    theme.palette.vesoft.status5Bg,
  ];
  return [colors[index % colors.length], bgColor[index % bgColor.length]];
};

// veditor's uuid should be a string without '-'
export const createUuid = (): string => uuid().replaceAll('-', '');

export const getVesoftBorder = ({ theme }: { theme: Theme }) => `${theme.palette.vesoft.textColor6} 1px solid`;

/**
 * ```
 * JSONBig is a JSON parser that can handle bigInt
 * for GQL result, always use JSONBig to parse and stringify data
 * ```
 */
export const JSONBig = JSONBigInt();

export const transformNebulaResult = (data: unknown, raw?: boolean): unknown => {
  const isNebulaType = data && typeof data === 'object' && 'raw' in data && 'value' in data;
  if (isNebulaType) {
    return raw ? data.raw : transformNebulaResult(data.value);
  }

  if (isType<Array<unknown>>(data, 'array')) {
    return data.map((val) => transformNebulaResult(val, raw));
  }

  if (isType<Object>(data, 'object')) {
    // for numbers transformed by JSONBig, we need to check if it's a big number
    if ('_isBigNumber' in data) {
      return data;
    }
    return Object.fromEntries(
      Object.entries(data).map(([key, val]) => {
        return [key, transformNebulaResult(val, raw)];
      })
    );
  }

  return data;
};

export const isDevMode = () => {
  return process.env.NODE_ENV === 'development';
};

export const encodeUrl = (url: string) => {
  if (!url) return '';
  return encodeURIComponent(url);
};

function recursiveUnset<T>(obj: T, field: keyof T): void {
  if (isObject(obj)) {
    unset(obj, field);
    Object.values(obj).forEach((value) => {
      if (isObject(value)) {
        recursiveUnset(value as T[keyof T], field as keyof T[keyof T]);
      }
    });
  }
}

export function isEqualIgnoringFields<T>(obj1: T, obj2: T, ignoreFields?: Array<keyof T>): boolean {
  // 创建对象的深拷贝，并删除指定的字段
  const cleanObj1 = cloneDeep(obj1);
  const cleanObj2 = cloneDeep(obj2);

  ignoreFields?.forEach((field) => {
    recursiveUnset<T>(cleanObj1, field);
    recursiveUnset<T>(cleanObj2, field);
  });

  // 使用 Lodash 的 isEqual 函数比较两个清理后的对象
  return isEqual(cleanObj1, cleanObj2);
}

export const extractEdgeByEdgeTypeName = (edgeTypeName: string) => {
  const arrs = [ForwardEdgePattern, BackwardEdgePattern, UndirectedEdgePattern];
  for (let i = 0; i < arrs.length; i++) {
    const pattern = arrs[i];
    const matched = edgeTypeName.match(pattern);
    if (!matched) continue;
    const [fromNodeName, name, dstNodeName] = matched.slice(1);
    return {
      fromNodeName,
      name,
      dstNodeName,
      direction: [EdgeDirectionType.Forward, EdgeDirectionType.Backward, EdgeDirectionType.Undirected][i],
    };
  }
  return undefined;
};

export function formatMicroseconds(microseconds: number) {
  const milliseconds = microseconds / 1000;
  const timeDuration = dayjs.duration(milliseconds, 'milliseconds');

  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(3)}ms`;
  } else if (milliseconds < 60000) {
    // Less than 60 seconds
    return `${timeDuration.asSeconds().toFixed(2)}s`;
  } else if (milliseconds < 3600000) {
    // Less than 60 minutes
    return `${timeDuration.asMinutes().toFixed(2)}m`;
  } else if (milliseconds < 86400000) {
    // Less than 24 hours
    return `${timeDuration.asHours().toFixed(2)}h`;
  } else {
    return `${timeDuration.asDays().toFixed(2)}d`;
  }
}

export const parseVertexValueToNodeObject = (
  vertex: VertexValue | PathValue<GraphNodeValue>,
  color: string
): NodeObject => {
  const { value } = vertex;
  return {
    id: value.id.toString(),
    data: vertex,
    color,
  } as NodeObject;
};

export const parseEdgeValueToLinkObject = (data: EdgeValue | PathValue<GraphEdgeValue>): LinkObject => {
  const { value } = data;
  return {
    id: getGraphEdgeId(value),
    source: value.srcId.toString(),
    target: value.dstId.toString(),
    rank: value.rank,
    edgeType: value.type,
    properties: value.properties,
    data,
    label: value.type,
  } as LinkObject;
};

/**
 * onPointerMove
 *
 * @param container dom
 * @param callback pointermove
 * @returns disposer
 */
export const onPointerMove = (container: HTMLElement, callback: (pos: Record<'top' | 'left', number>) => void) => {
  if (!container) {
    return () => {};
  }

  const react = container.getBoundingClientRect();
  const fn = (ev: PointerEvent) => {
    let left = ev.offsetX;
    let top = ev.offsetY;
    if (left + react.left > react.right) {
      left = left - NODE_SIZE * 2;
    }
    if (top + react.top > react.bottom) {
      top = top - NODE_SIZE * 2;
    }
    // update the pointer pos
    callback({ left: Math.round(left), top: Math.round(top) });
  };
  const listener = throttle(fn, 100);

  // Capture pointer coords on move or touchstart
  container.addEventListener('pointermove', listener, { passive: true });

  return () => container.removeEventListener('pointermove', listener);
};

export function injectCssVariable(theme: Theme) {
  const bodyStyle = document.querySelector('html')?.style;
  if (!bodyStyle) return;
  const variables: Record<string, string> = {
    '--vesoft-bg-color': theme.palette.vesoft.bgColor,
  };
  Object.keys(variables).forEach((key) => {
    bodyStyle.setProperty(key, variables[key]);
  });
}

export const brandConfig = {
  name: import.meta.env.STUDIO_BRAND_NAME,
  nameZhCN: import.meta.env.STUDIO_BRAND_NAME_ZH_CN,
  consoleName: import.meta.env.STUDIO_BRAND_CONSOLE_NAME,
  consolePrompt: import.meta.env.STUDIO_BRAND_CONSOLE_PROMPT,
  studioTitle: import.meta.env.STUDIO_BRAND_STUDIO_TITLE,
  guiTitle: import.meta.env.STUDIO_BRAND_GUI_TITLE,
  copyright: import.meta.env.STUDIO_BRAND_COPYRIGHT,
  helpUrlTemplate: import.meta.env.STUDIO_BRAND_HELP_URL_TEMPLATE,
  defaultLanguage: import.meta.env.STUDIO_DEFAULT_LANGUAGE,
} as const;

export const isStudioTarget = process.env.APP_TARGET === AppTarget.Studio;
export const isGuiTarget = process.env.APP_TARGET === AppTarget.Gui;

export const isDefaultSchema = (schemaPath: string) => {
  return schemaPath === DEFAULT_SCHEMA_PATH;
};
