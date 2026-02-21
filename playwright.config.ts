import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  outputDir: 'test-results',
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1600, height: 1280 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
