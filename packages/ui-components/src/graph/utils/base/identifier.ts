/**
 * GQL identifier helpers.
 *
 * Kept in a dependency-free module so query builders (e.g. `utils/graph/base/dml.ts`)
 * can use them without pulling in the `@vesoft-inc/utils` barrel through `graph/utils/helpers`.
 */

export const handleEscape = (name: string) => name.replace(/\\/gm, '\\\\').replace(/`/gm, '\\`');

export const handleKeyword = (name: string) => {
  return `\`${handleEscape(name || '')}\``;
};
