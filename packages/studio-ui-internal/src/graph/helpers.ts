import dayjs from 'dayjs';

/**
 * @example
 * ```ts
 * const [data, err] = to<Record<'a', number>>(() => JSON.parse('{"a": 1}'));
 * if (err) {
 *   console.log(err);
 * } else {
 *   console.log(data!.a);
 * }
 * ```
 */
export function to<R, U = Error>(f: () => R): [undefined, U] | [R, undefined] {
  try {
    return [f(), undefined];
  } catch (err) {
    return [undefined, err as U];
  }
}

/**
 * @example
 * ```ts
 * const [data, err] = safeParse<Record<'a', number>>('{"a": 1}');
 * ```
 */
export function safeParse<T = unknown>(str: string): [T, undefined] | [undefined, Error] {
  try {
    if (typeof str === 'string') {
      str = str?.replace(`\t`, ' ');
    }
    return [JSON.parse(str) as T, undefined];
  } catch (error) {
    return [undefined, error as Error];
  }
}

export function randomId() {
  const dateTime = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.random().toString(36).slice(-3);
  return `${dateTime}_${random}`;
}

export function NoopComponent() {
  return null;
}
