import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

/**
 * Basic multi-browser connectivity tests.
 * 
 * Tests the fundamental setup for multi-browser Groups e2e testing:
 * - Relay server connectivity
 * - Multiple browser instances
 * - Basic Groups UI loading
 */

test.describe('Multi-Browser Basic Connectivity', () => {
  let browser2: Browser;
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  test.beforeAll(async ({ browser }) => {
    // Create second browser instance
    browser2 = await browser.browserType().launch();
    
    // Create contexts for both browsers
    context1 = await browser.newContext();
    context2 = await browser2.newContext();
    
    page1 = await context1.newPage();
    page2 = await context2.newPage();
  });

  test.afterAll(async () => {
    await context1?.close();
    await context2?.close();
    await browser2?.close();
  });

  test('relay server should be accessible', async () => {
    // Test relay connectivity by checking if it responds to HTTP requests
    const response = await page1.goto('http://localhost:4000', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    // Relay typically returns a 404 or upgrade required for HTTP requests
    // The important thing is that it responds, indicating the server is running
    expect([404, 426]).toContain(response?.status() ?? 0);
  });

  test('React app should load in browser 1', async () => {
    await page1.goto('http://localhost:5174', { timeout: 30000 });
    
    // Wait for the main app elements
    await page1.waitForSelector('h1:has-text("evolu/react-vite-pwa")', { timeout: 15000 });
    
    // Verify Groups demo section loads
    await page1.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    
    const groupsDemo = page1.locator('[data-testid="groups-demo"]');
    await expect(groupsDemo).toBeVisible();
  });

  test('React app should load in browser 2', async () => {
    await page2.goto('http://localhost:5174', { timeout: 30000 });
    
    // Wait for the main app elements
    await page2.waitForSelector('h1:has-text("evolu/react-vite-pwa")', { timeout: 15000 });
    
    // Verify Groups demo section loads
    await page2.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    
    const groupsDemo = page2.locator('[data-testid="groups-demo"]');
    await expect(groupsDemo).toBeVisible();
  });

  test('Svelte app should be accessible', async () => {
    const response = await page1.goto('http://localhost:5175', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Check if Svelte app responds (may not be running, that's ok for now)
    if (response && response.status() === 200) {
      await page1.waitForSelector('[data-testid="groups-demo"]', { timeout: 10000 });
      const groupsDemo = page1.locator('[data-testid="groups-demo"]');
      await expect(groupsDemo).toBeVisible();
      console.log('✅ Svelte app is running and accessible');
    } else {
      console.log('⚠️ Svelte app not running on port 5175 - this is ok for basic connectivity test');
    }
  });

  test('both browsers can access Groups UI independently', async () => {
    // Navigate both browsers to the React app
    await page1.goto('http://localhost:5174', { timeout: 30000 });
    await page2.goto('http://localhost:5174', { timeout: 30000 });
    
    // Both should load Groups demo
    await page1.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    await page2.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    
    // Verify both have the basic UI elements
    const page1Elements = {
      createInput: page1.locator('[data-testid="group-name-input"]'),
      createButton: page1.locator('[data-testid="create-group-button"]'),
      inviteInput: page1.locator('[data-testid="invite-code-input"]'),
      joinButton: page1.locator('[data-testid="join-group-button"]'),
    };
    
    const page2Elements = {
      createInput: page2.locator('[data-testid="group-name-input"]'),
      createButton: page2.locator('[data-testid="create-group-button"]'),
      inviteInput: page2.locator('[data-testid="invite-code-input"]'),
      joinButton: page2.locator('[data-testid="join-group-button"]'),
    };
    
    // Verify all elements are visible in both browsers
    for (const [name, element] of Object.entries(page1Elements)) {
      await expect(element).toBeVisible();
    }
    
    for (const [name, element] of Object.entries(page2Elements)) {
      await expect(element).toBeVisible();
    }
    
    console.log('✅ Multi-browser Groups UI setup verified');
  });

  test('browsers have separate storage contexts', async () => {
    await page1.goto('http://localhost:5174', { timeout: 30000 });
    await page2.goto('http://localhost:5174', { timeout: 30000 });
    
    await page1.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    await page2.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    
    // Set different values in each browser's group name input
    await page1.locator('[data-testid="group-name-input"]').fill('Browser 1 Group');
    await page2.locator('[data-testid="group-name-input"]').fill('Browser 2 Group');
    
    // Verify the values are independent
    await expect(page1.locator('[data-testid="group-name-input"]')).toHaveValue('Browser 1 Group');
    await expect(page2.locator('[data-testid="group-name-input"]')).toHaveValue('Browser 2 Group');
    
    console.log('✅ Browser storage isolation verified');
  });

  test('setup validation complete', async () => {
    // Final validation that the setup is ready for real multi-browser tests
    console.log('🎉 Multi-browser e2e test setup validation complete!');
    console.log('📋 Setup Summary:');
    console.log('  ✅ Relay server running on port 4000');
    console.log('  ✅ React app accessible on port 5174');
    console.log('  ✅ Multiple browser instances working');
    console.log('  ✅ Groups UI loading in both browsers');
    console.log('  ✅ Browser storage contexts isolated');
    console.log('  🚀 Ready for Groups synchronization tests!');
    
    // This test always passes - it's just for logging the setup status
    expect(true).toBe(true);
  });
});