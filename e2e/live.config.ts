import { defineConfig } from '@playwright/test';
// Live profiles use deployed hosts and real credentials. Keep request bodies and screenshots out of reports.
export default defineConfig({
  testDir: './live',
  outputDir: '../test-results/live',
  workers: 1,
  timeout: 60000,
  use: { locale: 'en-US', trace: 'off', screenshot: 'off', video: 'off' },
});
