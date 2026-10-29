import { describe, expect, it } from 'vitest';
import { BigNumber } from 'bignumber.js';
import { GraphEntityType, PropertyDataType } from '@vesoft-inc/studio-core/contracts';
import type { NodeObject } from '@vesoft-inc/force-graph';
import { ConditionFilter } from './explorer';
import { RawEntityType } from './gql';
import { OperatorType } from '../constants';

function matches(raw: unknown, value: string, data_type = PropertyDataType.BOOL, operator = OperatorType.Equal) {
  const filter = new ConditionFilter({
    entity_name: 'Person',
    property_name: 'value',
    value,
    operator,
    enable: true,
    property: {
      type_name: 'Person',
      type: GraphEntityType.Node,
      property_name: 'value',
      data_type,
      primary_key: '',
      nullable: true,
      default: '',
    },
  });
  const node: NodeObject = {
    id: '1',
    data: {
      raw: '1',
      type: RawEntityType.NODE,
      value: { id: 1, graph: 'demo', type: 'Person', labels: [], properties: { value: raw } },
    },
  };
  return filter.isMeetCondition(node);
}

describe('ConditionFilter runtime values', () => {
  it.each([
    [true, 'true', true],
    [false, 'true', false],
    [false, 'false', true],
    [true, 'false', false],
    ['true', 'true', true],
    [' FALSE ', 'false', true],
  ])('compares BOOL %s with %s', (raw, value, expected) => {
    expect(matches(raw, value as string)).toBe(expected);
  });

  it.each([null, undefined])('does not match a null or missing value (%s)', (raw) => {
    for (const operator of Object.values(OperatorType)) {
      expect(matches(raw, 'false', PropertyDataType.BOOL, operator)).toBe(false);
      expect(matches(raw, '0', PropertyDataType.INT32, operator)).toBe(false);
      expect(matches(raw, '', PropertyDataType.STRING, operator)).toBe(false);
    }
  });

  it('retains number, numeric wrapper, string and date comparisons', () => {
    expect(matches(0, '0', PropertyDataType.INT32)).toBe(true);
    expect(matches(1.5, '1', PropertyDataType.DOUBLE, OperatorType.GreaterThan)).toBe(true);
    expect(matches(new BigNumber(42), '42', PropertyDataType.INT64)).toBe(true);
    expect(matches('false', 'fal', PropertyDataType.STRING, OperatorType.StartsWith)).toBe(true);
    expect(matches('2026-10-24', '2026-10-23', PropertyDataType.DATE, OperatorType.GreaterThan)).toBe(true);
  });
});
