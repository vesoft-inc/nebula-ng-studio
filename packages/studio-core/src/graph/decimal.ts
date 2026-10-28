export const DECIMAL_MAX_PRECISION = 256;
export const DECIMAL_MAX_SCALE = 128;
export const DECIMAL_DEFAULT_PRECISION = 10;
export const DECIMAL_DEFAULT_SCALE = 0;

export type DecimalParameters = { decimalPrecision?: unknown; decimalScale?: unknown };

export function normalizeDecimalParameter(value: unknown): number | undefined {
  if (value == null || (typeof value === 'string' && !value.trim())) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value);
  return NaN;
}

export function resolveDecimalParameters(property: DecimalParameters) {
  return {
    decimalPrecision: normalizeDecimalParameter(property.decimalPrecision) ?? DECIMAL_DEFAULT_PRECISION,
    decimalScale: normalizeDecimalParameter(property.decimalScale) ?? DECIMAL_DEFAULT_SCALE,
  };
}

export function getDecimalParameterError(property: DecimalParameters): 'precision' | 'scale' | null {
  const { decimalPrecision: precision, decimalScale: scale } = resolveDecimalParameters(property);
  if (!Number.isInteger(precision) || precision < 1 || precision > DECIMAL_MAX_PRECISION) return 'precision';
  if (!Number.isInteger(scale) || scale < 0 || scale > DECIMAL_MAX_SCALE || scale > precision) return 'scale';
  return null;
}

export function parseDecimalType(type: string) {
  const match = type.trim().match(/^(?:DECIMAL|DEC)(?:\s*\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\))?$/i);
  if (!match) return null;
  return resolveDecimalParameters({ decimalPrecision: match[1], decimalScale: match[2] });
}
