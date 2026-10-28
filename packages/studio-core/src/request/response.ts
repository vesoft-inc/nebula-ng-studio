import { HttpResCode } from '../contracts/constants.js';
import { JSONBig } from '../graph/json.js';

/** Decode response bodies while preserving large integers and the server error envelope. */
export function parseResponseBody(data: string, contentType: unknown, status?: number): unknown {
  if (contentType !== 'application/json') {
    if (status !== undefined && status >= 200 && status < 300) {
      return { code: 0, data };
    }

    return { code: status, message: data };
  }
  try {
    return JSONBig.parse(data);
  } catch (e) {
    return { code: HttpResCode.ErrUnknown, message: `${e}`, data };
  }
}
