import type { PlaywrightTestConfig } from '@playwright/test';
import base from './playwright.config.js';

const webServers = base.webServer
  ? Array.isArray(base.webServer)
    ? base.webServer
    : [base.webServer]
  : [];

const config: PlaywrightTestConfig = {
  ...base,
  webServer: webServers.map((server) => ({
    ...server,
    reuseExistingServer: true
  }))
};

export default config;
