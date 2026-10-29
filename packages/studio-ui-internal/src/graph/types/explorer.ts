import React from 'react';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import {
  DescEdgeTypeResult,
  DescGraphTypeResult,
  DescNodeTypeResult,
  EdgeDirectionType,
} from '@vesoft-inc/studio-core/contracts';
import { FORCEGRAPH_COLOR_PICK_LIST, LABEL_COLOR_PICK_LIST } from '../../theme/palette';
import { RawEntityType } from './gql';
import { IObservableArray } from 'mobx';
import { ConditionFactories, DEFAULT_LINK_COLOR, OperatorType } from '../constants';
import { parseValueByPropertyType } from '../utils/helpers';
import type { GraphRuntimeState, OpenedSnapshot } from '../snapshot/types';
import type { FilterDefinition } from '../../contracts/filter';
import type { IconGroupData, IconItemData } from '../../contracts/icons';
export type { DisplayedPropertyItem } from '../../contracts/graph';

/** @deprecated Runtime state, not API JSON. Use SnapshotRecord/SnapshotPayload from /contracts for transport. */
export type SnapshotData = GraphRuntimeState;

/** @deprecated An opened runtime snapshot. API services use SnapshotRecord from /contracts. */
export type Snapshot = OpenedSnapshot;

export interface Pointer {
  top: number;
  left: number;
  event?: unknown;
  /** element currently being pointed to */
  source?: unknown;
  showContextMenu?: boolean;
}

export interface ITransform {
  x: number;
  y: number;
  k: number;
}

export enum SiderPanel {
  GraphQuery = 'GraphQuery',
  GraphQueryNode = 'GraphQueryNode',
  GraphQueryPrimaryKey = 'GraphQueryPrimaryKey',
  GraphQueryConditional = 'GraphQueryConditional',
  GraphExploreRelation = 'GraphExploreRelation',
  GraphQueryPath = 'GraphQueryPath',
  GraphProperty = 'GraphProperty',
  GraphFilter = 'GraphFilter',
  GraphTag = 'GraphTag',
  GraphView = 'GraphView',
}

export interface IRules {
  edgeTypes?: string[];
  edgeDirection?: EdgeDirectionType;
  vertexStyle?: string;
  limit?: `${number}`;
  stepsType?: string;
  step?: number;
  minStep?: number;
  maxStep?: number;
  customColor?: string;
  customIcon?: string;
  customImageId?: string;
}

// export enum EdgeDirectionType {
//   /** 正向 */
//   Forward = 1,
//   /** 无向 */
//   Undirected,
//   /** 反向 */
//   Backward,
// }

export class ColorPicker {
  #colorsRecord: Map<string, string>;
  #type: 'node' | 'label' | 'link' = 'node';

  constructor(type?: 'node' | 'label' | 'link') {
    this.#colorsRecord = new Map<string, string>();
    this.#type = type || 'node';
  }

  get colorPickList() {
    return this.#type === 'node' ? FORCEGRAPH_COLOR_PICK_LIST : LABEL_COLOR_PICK_LIST;
  }

  get colorMap(): Map<string, string> {
    return this.#colorsRecord;
  }

  nextColor = (): string => {
    for (let i = 0; i < this.colorPickList.length; i++) {
      const color = this.colorPickList[i];
      if (!Array.from(this.colorMap.values()).includes(color)) {
        return color;
      }
    }
    // if all color used, return random color in the list
    return this.colorPickList[(Math.random() * this.colorPickList.length) | 0];
  };

  whichColor = (key: string, color?: string): string => {
    if (!this.#colorsRecord.has(key)) {
      if (color) {
        this.#colorsRecord.set(key, color);
      } else {
        this.#colorsRecord.set(key, this.#type === 'link' ? DEFAULT_LINK_COLOR : this.nextColor());
      }
    }
    return this.#colorsRecord.get(key)!;
  };

  clear = () => {
    this.#colorsRecord.clear();
  };

  initColorMap = (
    originData: {
      key: string;
      defaultColor?: string;
    }[]
  ) => {
    originData.forEach((item) => {
      this.whichColor(item.key, item.defaultColor);
    });
  };

  setColor = (key: string, color: string) => {
    this.#colorsRecord.set(key, color);
  };
}

export interface ICondtionItem {
  property: string;
  operator: string;
  value: string;
  // WHERE OR AND ...
  prefix: string;
}

export interface IConditionQuery {
  typeName: string;
  entityType: RawEntityType.NODE | RawEntityType.EDGE;
  label: string;
  conditions: ICondtionItem[];
}

export type IconItem = IconItemData;

/** Runtime catalog group. Service responses use IconGroupRecord. */
export interface IconGroup extends Omit<IconGroupData, 'icons'> {
  icons: IObservableArray<IconItem>;
}

export class ConditionFilter implements FilterDefinition {
  property?: DescEdgeTypeResult | DescNodeTypeResult;
  property_name?: string;
  operator: OperatorType;
  entity?: DescGraphTypeResult;
  entity_name?: string;
  value: string;
  enable: boolean;

  constructor(params: FilterDefinition) {
    const { property, property_name, operator, entity, entity_name, value, enable } = params;
    this.property = property;
    this.property_name = property_name;
    this.operator = operator;
    this.entity = entity;
    this.entity_name = entity_name;
    this.value = value;
    this.enable = enable;
  }

  isSameType = (item: NodeObject | LinkObject) => {
    return item.data.value.type === this.entity_name;
  };

  isMeetCondition = (item: NodeObject | LinkObject) => {
    if (!this.enable) {
      return false;
    }
    if (!this.property_name) return false;
    if (!this.property?.data_type) return false;
    const rawValue = item.data.value.properties[this.property_name];
    // Missing and null properties do not satisfy comparisons (including !=).
    if (rawValue == null) return false;
    const invokeFn = ConditionFactories.find((item) => item.operator === this.operator)!.invoke;
    const fieldValue = parseValueByPropertyType(String(rawValue), this.property.data_type, false);
    const value = parseValueByPropertyType(this.value, this.property.data_type, false);
    return invokeFn({
      fieldValue,
      value,
    });
  };

  getValues = (): FilterDefinition => {
    return {
      property: this.property,
      property_name: this.property_name,
      operator: this.operator,
      entity: this.entity,
      entity_name: this.entity_name,
      value: this.value,
      enable: this.enable,
    };
  };
}

export interface IContextMenuItem {
  key: string;
  title: string | React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
}

export interface StyleSetPopoverConfig {
  anchorEl: HTMLElement | null;
  currentColor?: string;
  currentSize?: string;
}
