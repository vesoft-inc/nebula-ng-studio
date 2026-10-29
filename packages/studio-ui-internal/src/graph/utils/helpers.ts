import { convertBigNumberToString } from '@vesoft-inc/studio-core/graph';
export { convertBigNumberToString, removeNullCharacters } from '@vesoft-inc/studio-core/graph';
import { throttle } from 'lodash';
import { type Theme } from '@mui/material';
import { DescGraphTypeResult, EdgeDirectionType, PropertyDataType } from '@vesoft-inc/studio-core/contracts';
import { css } from '@emotion/css';
import dayjs from 'dayjs';

import { NODE_SIZE } from './base/index';
import { PathType } from '../constants';
import { parseInt64Value } from './parseInt64Value';

export { handleEscape, handleKeyword } from './base/identifier';

export const handleVidStringName = (name: string, spaceVidType?: string) => {
  if (spaceVidType && spaceVidType === 'INT64' && !isNaN(parseInt(name, 10))) {
    return convertBigNumberToString(name);
  }
  return JSON.stringify(name);
};

/**
 * onPointerMove
 *
 * @param container dom
 * @param callback pointermove
 * @returns disposer
 */
export const onPointerMove = (container: HTMLElement, callback: (pos: Record<'top' | 'left', number>) => void) => {
  const react = container.getBoundingClientRect();
  const fn = (ev: PointerEvent) => {
    let left = ev.clientX - react.left - 20;
    let top = ev.clientY - react.top - 10;
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
    '--vesoft-bg-color-secondary': theme.palette.vesoft.bgColor12,
  };
  Object.keys(variables).forEach((key) => {
    bodyStyle.setProperty(key, variables[key]);
  });
}

export const getAllLabelsByGraphType = (elements: DescGraphTypeResult[]) => {
  const labels = new Set<string>();
  elements.forEach((element) => {
    element.labels.forEach((label) => labels.add(label));
  });
  return Array.from(labels);
};

export const fullScreenCls = css`
  position: fixed;
  z-index: 1299;
  width: 100vw;
  height: 100vh;
  left: 0;
  top: 0;
  margin: 0;
  padding: 0;
`;

export const parseValueByPropertyType = (value: string, type: PropertyDataType, gqlMode = true) => {
  switch (type) {
    case PropertyDataType.INT64:
      return parseInt64Value(value, gqlMode);
    case PropertyDataType.INT32:
    case PropertyDataType.INT16:
    case PropertyDataType.INT8:
      return parseInt(value, 10);
    case PropertyDataType.DOUBLE:
    case PropertyDataType.FLOAT:
      return parseFloat(value);
    case PropertyDataType.BOOL:
      return value.trim().toLowerCase() === 'true';
    case PropertyDataType.STRING:
      return gqlMode ? `"${value}"` : value;
    case PropertyDataType.LOCAL_DATETIME:
      return gqlMode ? `local_datetime("${value}")` : dayjs(value);
    case PropertyDataType.ZONED_DATETIME:
      return gqlMode ? `zoned_datetime("${value}")` : dayjs(value);
    case PropertyDataType.DATE:
      return gqlMode ? `date("${value}")` : dayjs(value);
    case PropertyDataType.LOCAL_TIME:
      return gqlMode ? `local_time("${value}")` : dayjs(value);
    case PropertyDataType.GEOGRAPHY:
    case PropertyDataType.GEOGRAPHY_ANY:
    case PropertyDataType.GEOGRAPHY_POINT:
    case PropertyDataType.GEOGRAPHY_POLYGON:
    case PropertyDataType.GEOGRAPHY_LINESTRING:
      return gqlMode ? `ST_GeogFromText("${value}")` : value;
    default:
      return gqlMode ? `${value}` : value;
  }
};

export const getDirection = (direction: EdgeDirectionType) => {
  let directions = ['-', '->'];
  switch (direction) {
    case EdgeDirectionType.Backward:
      directions = ['<-', '-'];
      break;
    case EdgeDirectionType.Undirected:
      directions = ['~', '~'];
      break;
    case EdgeDirectionType.Bidirect:
      directions = ['<-', '->'];
      break;
    case EdgeDirectionType.Forward:
      directions = ['-', '->'];
      break;
    case EdgeDirectionType.BackOrUndirected:
      directions = ['<~', '~'];
      break;
    case EdgeDirectionType.ForwardOrUndirected:
      directions = ['~', '~>'];
      break;
    case EdgeDirectionType.AnyDirection:
      directions = ['-', '-'];
      break;
    default:
      break;
  }
  return directions;
};

export const getPathPattern = (pathType: PathType): [string, string] => {
  switch (pathType) {
    case PathType.All:
      return ['ALL', 'PATHS'];
    case PathType.AnyOne:
      return ['ANY 1', 'PATH'];
    case PathType.AllShortest:
      return ['ALL SHORTEST', 'PATHS'];
    case PathType.OneShortest:
      return ['SHORTEST 1', 'PATH'];
    default:
      throw new Error('Invalid path type');
  }
};

export const SelectProps = {
  MenuProps: {
    slotProps: {
      paper: {
        sx: {
          maxHeight: 300,
          overflowY: 'auto',
          overflowX: 'auto',
        },
      },
    },
  },
  sx: {
    background: (theme: Theme) => theme.palette.vesoft.v2.bg1,
  },
};
