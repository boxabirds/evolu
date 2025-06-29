import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Evolu group functionality e2e tests.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'react-groups',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5174', // React app is running on 5174
      },
    },
    {
      name: 'svelte-groups',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5175', // Svelte app is running on 5175
      },
    },
  ],

  webServer: [
    {
      command: 'cd ../examples/react-vite-pwa && pnpm dev --port 5174',
      port: 5174,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd ../examples/svelte-vite-pwa && pnpm dev --port 5175',
      port: 5175,
      reuseExistingServer: !process.env.CI,
    },
  ],
});