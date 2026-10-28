export const removeNullCharacters = (data: string) => {
  return data.replace(/\u0000+$/, '');
};

export const handleEscape = (name: string) => name.replace(/\\/gm, '\\\\').replace(/`/gm, '\\`');

export const handleKeyword = (name: string) => {
  return `\`${handleEscape(name || '')}\``;
};
