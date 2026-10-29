/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: [
      './apps/web/index.html',
      './apps/web/src/**/*.{js,jsx,ts,tsx}',
      './apps/gui/index.html',
      './apps/gui/src/**/*.{js,jsx,ts,tsx}',
      './packages/studio-ui-internal/src/**/*.{js,jsx,ts,tsx}',
    ],
  },
  corePlugins: {
    preflight: false,
  },
};
