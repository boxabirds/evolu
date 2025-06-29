import { defineConfig, devices } from '@playwright/test';

/**
 * Multi-browser Playwright configuration for Evolu Groups functionality.
 * 
 * This configuration sets up real multi-browser e2e tests with:
 * - Auto-starting local relay server
 * - Multiple browser instances for sync testing
 * - Real Groups functionality testing (no mocks)
 * - Cross-browser data synchronization validation
 */
export default defineConfig({
  testDir: './tests/multibrowser',
  fullyParallel: false, // Sequential to control browser interactions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to ensure proper test ordering
  reporter: [
    ['html', { outputFolder: 'multibrowser-report' }],
    ['list']
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Longer timeouts for real sync operations
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'react-multibrowser',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5174',
        // Enable sync by setting relay URL
        storageState: {
          cookies: [],
          origins: [{
            origin: 'http://localhost:5174',
            localStorage: [
              // Configure apps to use local relay
              { name: 'evolu_relay_url', value: 'ws://localhost:4000' }
            ]
          }]
        }
      },
    },
    {
      name: 'svelte-multibrowser',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5175',
        storageState: {
          cookies: [],
          origins: [{
            origin: 'http://localhost:5175',
            localStorage: [
              { name: 'evolu_relay_url', value: 'ws://localhost:4000' }
            ]
          }]
        }
      },
    },
  ],

  webServer: [
    // Start relay server first
    {
      command: 'cd ../apps/relay && pnpm dev',
      port: 4000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    // Start React app
    {
      command: 'cd ../examples/react-vite-pwa && pnpm dev --port 5174',
      port: 5174,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    // Start Svelte app
    {
      command: 'cd ../examples/svelte-vite-pwa && pnpm dev --port 5175',
      port: 5175,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});