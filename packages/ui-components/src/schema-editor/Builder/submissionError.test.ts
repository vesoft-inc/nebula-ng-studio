import { describe, expect, it } from 'vitest';
import { getGraphTypeSubmissionError } from './submissionError';

describe('graph type submission error presentation', () => {
  const fallback = 'Unable to submit. Your changes are preserved.';

  it('keeps the API code and Graphd explanation without the internal namespace', () => {
    expect(
      getGraphTypeSubmissionError(
        { code: 50004000, message: 'ErrInternalServer::[NT002]: Unsupported, node type without primary key: Person' },
        fallback
      )
    ).toBe('[50004000] [NT002]: Unsupported, node type without primary key: Person');
  });

  it('reads HTTP error response bodies without displaying request details', () => {
    expect(
      getGraphTypeSubmissionError(
        { response: { data: { code: 50004000, message: 'Server rejected DDL' } }, config: { secret: 'hidden' } },
        fallback
      )
    ).toBe('[50004000] Server rejected DDL');
  });

  it('handles rejected network errors', () => {
    expect(getGraphTypeSubmissionError(new Error('Network Error'), fallback)).toBe('Network Error');
    expect(getGraphTypeSubmissionError({ code: 'ECONNABORTED', message: 'timeout' }, fallback)).toBe(
      '[ECONNABORTED] timeout'
    );
  });

  it.each([null, undefined, '', {}, { message: ' ' }, { message: 23 }])('uses a readable fallback for %j', (value) => {
    expect(getGraphTypeSubmissionError(value, fallback)).toBe(fallback);
  });

  it('preserves an API code when the server omits the message', () => {
    expect(getGraphTypeSubmissionError({ code: 50004000 }, fallback)).toBe(`[50004000] ${fallback}`);
  });
});
