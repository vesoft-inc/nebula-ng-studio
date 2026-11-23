import { defineConfig } from '@playwright/test';
const hosts = { web: 4174, gui: 4175 };
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  workers: 3,
  use: {
    actionTimeout: 6500,
    viewport: { width: 1480, height: 980 },
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: Object.entries(hosts).map(([name, port]) => ({
    name,
    testMatch: '**/' + name + '/*.spec.ts',
    use: { baseURL: 'http://127.0.0.1:' + port },
  })),
  webServer: Object.entries(hosts).map(([name, port]) => ({
    command: 'pnpm --dir apps/' + name + ' exec vite preview --host 127.0.0.1 --strictPort --port ' + port,
    url: 'http://127.0.0.1:' + port,
  })),
});
