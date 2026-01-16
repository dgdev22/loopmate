import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  /* Test timeout settings (Electron app may start slowly) */
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  /* Whether to run tests in parallel */
  fullyParallel: false,
  /* Retry on failure in CI */
  retries: process.env.CI ? 2 : 0,
  /* Number of workers to use in CI */
  workers: process.env.CI ? 1 : 1,
  /* Reporter settings */
  reporter: 'html',
  /* Shared settings */
  use: {
    /* Default timeout */
    actionTimeout: 0,
    /* Take screenshots */
    screenshot: 'only-on-failure',
    /* Record video */
    video: 'retain-on-failure',
    /* Trace */
    trace: 'on-first-retry',
  },

  /* Test project settings */
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Electron app URL (development mode)
        baseURL: 'http://localhost:5173',
      },
    },
  ],

  /* Web server settings - run in development mode */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Deterministic E2E env: ensure NODE_ENV/VITE_E2E below are applied.
    // Opt-in reuse via PW_REUSE_EXISTING_SERVER=1 if you really want it locally.
    reuseExistingServer: !!process.env.PW_REUSE_EXISTING_SERVER && !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VITE_E2E: '1'
    },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

