export default {
  'apps/web/**/*.{ts,tsx}': () => 'turbo run lint:types --filter=./apps/web',
  'apps/gui/**/*.{ts,tsx}': () => 'turbo run lint:types --filter=./apps/gui',
  '*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}': ['eslint --fix', 'prettier --write --ignore-path .prettierignore'],
  '*.json': 'prettier --write --ignore-path .prettierignore',
};
