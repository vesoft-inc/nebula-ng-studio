import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      setupFiles: ['./src/test-support/setup.ts'],
      server: { deps: { inline: ['@vesoft-inc/icons'] } },
    },
  })
);
