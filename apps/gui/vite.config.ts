import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import pkg from './package.json';

const TARGET_URL = process.env.GUI_API_TARGET || 'http://127.0.0.1:19669';

const CLIENT_BRAND_DEFAULTS = {
  STUDIO_BRAND_NAME: 'NebulaGraph',
  STUDIO_BRAND_NAME_ZH_CN: 'NebulaGraph',
  STUDIO_BRAND_CONSOLE_NAME: 'NebulaGraph',
  STUDIO_BRAND_CONSOLE_PROMPT: 'nebula',
  STUDIO_BRAND_STUDIO_TITLE: 'NebulaGraph Studio',
  STUDIO_BRAND_GUI_TITLE: 'NebulaGraph Console',
  STUDIO_BRAND_COPYRIGHT: 'Copyright © vesoft inc.',
  STUDIO_BRAND_HELP_URL_TEMPLATE: 'https://ent-docs.nebula-graph.io/{coreVersion}',
  STUDIO_DEFAULT_LANGUAGE: 'en_US',
} as const;

const resolveBrandEnv = (mode: string) => {
  const fileEnv = loadEnv(mode, __dirname, Object.keys(CLIENT_BRAND_DEFAULTS));
  return Object.fromEntries(
    Object.entries(CLIENT_BRAND_DEFAULTS).map(([key, fallback]) => [key, process.env[key] ?? fileEnv[key] ?? fallback])
  ) as Record<keyof typeof CLIENT_BRAND_DEFAULTS, string>;
};

export default defineConfig(({ mode }) => {
  const brandEnv = resolveBrandEnv(mode);
  Object.assign(process.env, brandEnv);

  return {
    envPrefix: ['STUDIO_BRAND_', 'STUDIO_DEFAULT_LANGUAGE'],
    plugins: [
      react(),
      ViteEjsPlugin(() => {
        return {
          env: brandEnv,
        };
      }),
    ],
    server: {
      port: 3000,
      open: true,
      host: '0.0.0.0',
      proxy: {
        '/api-gui': {
          target: TARGET_URL,
          rewrite: (path) => path.replace(/^\/api-gui/, ''),
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@gui': path.join(__dirname, './src'),
        '@studio': path.join(__dirname, '../web/src'),
        '@public': path.join(__dirname, './public/'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    css: {
      postcss: path.join(__dirname, '../..'),
    },
    base: '/',
    build: {
      outDir: 'dist',
    },
    define: {
      'process.env': {
        VERSION: pkg.version,
        APP_TARGET: 'GUI',
        TARGET_URL,
      },
    },
  };
});
