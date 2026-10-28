import { describe, expect, it } from 'vitest';
import { getDecimalParameterError, normalizeDecimalParameter, parseDecimalType } from './decimal.js';
import { parsePropertyDataType } from './typeParsing.js';
import { PropertyDataType } from '../contracts/constants.js';

describe('DECIMAL parameters', () => {
  it.each([
    [undefined, undefined],
    [null, null],
    ['', ''],
    [' ', ' '],
    [1, 0],
    [256, 128],
    [128, 128],
    ['256', '128'],
    [12, undefined],
    [undefined, 0],
    [undefined, 10],
    [12, '0'],
  ])('accepts precision=%s scale=%s', (decimalPrecision, decimalScale) => {
    expect(getDecimalParameterError({ decimalPrecision, decimalScale })).toBeNull();
  });
  it.each([0, -1, 257, 1.5, NaN, Infinity, -Infinity, 'NaN', 'Infinity', '1.5', '0x10', '1e2', {}, true])(
    'rejects invalid precision %s',
    (decimalPrecision) => {
      expect(getDecimalParameterError({ decimalPrecision, decimalScale: 0 })).toBe('precision');
    }
  );
  it.each([-1, 129, 256, 0.5, NaN, Infinity, 'false', {}, true])('rejects invalid scale %s', (decimalScale) => {
    expect(getDecimalParameterError({ decimalPrecision: 256, decimalScale })).toBe('scale');
  });
  it('validates scale against explicit or default precision', () => {
    expect(getDecimalParameterError({ decimalPrecision: 3, decimalScale: 4 })).toBe('scale');
    expect(getDecimalParameterError({ decimalScale: 11 })).toBe('scale');
    expect(normalizeDecimalParameter('0')).toBe(0);
  });
});

describe('DECIMAL metadata parsing', () => {
  it.each([
    ['DECIMAL', 10, 0],
    ['DECIMAL(12)', 12, 0],
    ['DECIMAL(12,0)', 12, 0],
    ['DECIMAL(256, 128)', 256, 128],
    [' decimal ( 12 , 3 ) ', 12, 3],
    ['DEC', 10, 0],
    ['dec(12)', 12, 0],
  ])('parses %s without inventing zero precision', (type, decimalPrecision, decimalScale) => {
    expect(parsePropertyDataType(type as string)).toEqual({
      type: PropertyDataType.DECIMAL,
      decimalPrecision,
      decimalScale,
    });
  });
  it.each(['DECIMAL()', 'DECIMAL(foo)', 'DECIMAL(12,)', 'DECIMAL(12,3) garbage', 'DECIMAL(-1,0)'])(
    'does not silently turn malformed metadata %s into a valid default',
    (type) => {
      expect(parseDecimalType(type)).toBeNull();
      expect(parsePropertyDataType(type)).toEqual({ type });
    }
  );
});
