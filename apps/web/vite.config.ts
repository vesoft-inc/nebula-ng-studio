import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { ViteEjsPlugin } from 'vite-plugin-ejs';

const proxyHost = '127.0.0.1:7001';

const CLIENT_BRAND_DEFAULTS = {
  STUDIO_BRAND_NAME: 'NebulaGraph',
  STUDIO_BRAND_NAME_ZH_CN: 'NebulaGraph',
  STUDIO_BRAND_CONSOLE_NAME: 'NebulaGraph',
  STUDIO_BRAND_CONSOLE_PROMPT: 'nebula',
  STUDIO_BRAND_STUDIO_TITLE: 'NebulaGraph Studio',
  STUDIO_BRAND_GUI_TITLE: 'NebulaGraph Console',
  STUDIO_BRAND_COPYRIGHT: 'Copyright © Vesoft Inc.',
  STUDIO_BRAND_HELP_URL_TEMPLATE: 'https://ent-docs.nebula-graph.io/{coreVersion}',
  STUDIO_DEFAULT_LANGUAGE: 'en_US',
} as const;

const resolveBrandEnv = (mode: string) => {
  const fileEnv = loadEnv(mode, __dirname, Object.keys(CLIENT_BRAND_DEFAULTS));
  return Object.fromEntries(
    Object.entries(CLIENT_BRAND_DEFAULTS).map(([key, fallback]) => [key, process.env[key] ?? fileEnv[key] ?? fallback])
  ) as Record<keyof typeof CLIENT_BRAND_DEFAULTS, string>;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const brandEnv = resolveBrandEnv(mode);
  const studioVersion = process.env.STUDIO_VERSION || 'dev';
  Object.assign(process.env, brandEnv);

  return {
    envPrefix: ['STUDIO_BRAND_', 'STUDIO_DEFAULT_LANGUAGE'],
    plugins: [
      react(),
      ViteEjsPlugin(() => {
        return {
          env: {
            ...brandEnv,
            env: process.env.NODE_ENV,
          },
        };
      }),
    ],
    server: {
      port: 3000,
      open: true,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: `http://${proxyHost}`,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@studio': path.join(__dirname, './src/'),
        '@gui': path.join(__dirname, '../gui/src/'),
        '@public': path.join(__dirname, './public/'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    css: {
      postcss: path.join(__dirname, '../..'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    define: {
      'process.env': {
        VERSION: studioVersion,
        APP_TARGET: 'STUDIO',
        env: process.env.NODE_ENV,
      },
    },
  };
});
