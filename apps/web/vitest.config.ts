import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      server: { deps: { inline: ['@vesoft-inc/icons'] } },
    },
  })
);
