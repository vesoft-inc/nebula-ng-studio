/** Accept both API error envelopes and rejected transport errors without displaying request details. */
export const getGraphTypeSubmissionError = (error: unknown, fallback: string): string => {
  if (!error || typeof error !== 'object') return fallback;
  const result = error as { code?: unknown; message?: unknown; response?: { data?: unknown } };
  if (result.response?.data) return getGraphTypeSubmissionError(result.response.data, fallback);
  const message = typeof result.message === 'string' ? result.message.replace(/^\w+::/, '').trim() : '';
  const code = typeof result.code === 'number' || typeof result.code === 'string' ? `${result.code}` : '';
  return `${code ? `[${code}] ` : ''}${message || fallback}`;
};
