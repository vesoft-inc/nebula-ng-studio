const INTEGER_LITERAL_PATTERN = /^[+-]?\d+$/;

export const parseInt64Value = (value: string | { toString(): string }, gqlMode: boolean) => {
  const normalizedValue = String(value).trim();

  // GQL accepts the decimal literal directly, avoiding JavaScript's safe-integer limit.
  if (gqlMode && INTEGER_LITERAL_PATTERN.test(normalizedValue)) {
    return normalizedValue;
  }

  return parseInt(normalizedValue, 10);
};
