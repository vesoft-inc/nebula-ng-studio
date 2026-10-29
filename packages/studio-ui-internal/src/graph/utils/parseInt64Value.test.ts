import { describe, expect, it } from 'vitest';

import { parseInt64Value } from './parseInt64Value';

describe('parseInt64Value', () => {
  it('preserves INT64 literals in GQL mode', () => {
    const reportedId = '4711650042212010102';

    expect(parseInt64Value(reportedId, true)).toBe(reportedId);
    expect(parseInt64Value('9223372036854775807', true)).toBe('9223372036854775807');
    expect(parseInt64Value('-9223372036854775808', true)).toBe('-9223372036854775808');
    expect(parseInt64Value(`  ${reportedId}  `, true)).toBe(reportedId);
    expect(parseInt64Value({ toString: () => reportedId }, true)).toBe(reportedId);
  });

  it('keeps the existing numeric parsing outside GQL literals', () => {
    expect(parseInt64Value('42', false)).toBe(42);
    expect(parseInt64Value('42suffix', true)).toBe(42);
  });
});
