import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const env = require('./scripts/env');

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  // Locally the system Chrome occasionally stalls in "Create context" under heavy machine load.
  retries: isCI ? 2 : 1,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : isCI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: isCI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['github']]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: path.join(__dirname, 'tests', 'helpers', 'global-setup.ts'),
  use: {
    baseURL: env.BASE_URL,
    // Local runs reuse the installed Google Chrome (no browser download); E2E_CHANNEL=chromium overrides.
    channel: process.env.E2E_CHANNEL || (isCI ? undefined : 'chrome'),
    serviceWorkers: 'block',
    // Splash keeps 2.7 s min otherwise; with reduce it is 0.32 s (boot.spec checks the default too).
    reducedMotion: 'reduce',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [`--host-resolver-rules=MAP ${env.E2E_HOST} 127.0.0.1`],
    },
  },
  projects: [
    {
      name: 'mobile',
      grepInvert: /@desktop-only/,
      use: {
        userAgent: devices['Pixel 7'].userAgent,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop',
      grepInvert: /@mobile-only/,
      use: {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
  webServer: {
    command: 'node scripts/start-server.js',
    cwd: __dirname,
    url: `${env.DIRECT_URL}/health`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
