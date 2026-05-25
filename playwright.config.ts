import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command:
        'AI_MEDIA_DATA_DIR=.data/e2e npm run fixtures && AI_MEDIA_DATA_DIR=.data/e2e AI_PROVIDER=mock AI_MEDIA_ENABLE_DEV_ROUTES=1 npm run dev',
      port: 8787,
      reuseExistingServer: false
    },
    {
      command: 'npm run dev:client',
      port: 5173,
      reuseExistingServer: false
    }
  ]
});
