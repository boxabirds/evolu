import { test, expect } from '@playwright/test';

test.describe('Simple App Test', () => {
  test('React app should load', async ({ page }) => {
    await page.goto('/');
    
    // Wait for any element to ensure page loaded
    await page.waitForLoadState('networkidle');
    
    // Check if the main app header exists
    const appTitle = await page.textContent('h1');
    console.log('App title:', appTitle);
    
    // Check for any error messages
    const bodyText = await page.textContent('body');
    console.log('Body content (first 500 chars):', bodyText?.substring(0, 500));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'react-app-loaded.png' });
    
    // Basic check - app should have some content
    expect(bodyText).toBeTruthy();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});