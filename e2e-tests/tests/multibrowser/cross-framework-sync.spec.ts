import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

/**
 * Cross-framework Groups synchronization tests.
 * 
 * Tests Groups functionality between React and Svelte implementations
 * to ensure framework-agnostic compatibility via the common Evolu core.
 */

interface CrossFrameworkSetup {
  browser1: Browser;
  browser2: Browser;
  context1: BrowserContext;
  context2: BrowserContext;
  reactPage: Page;
  sveltePage: Page;
}

test.describe('Cross-Framework Groups Synchronization', () => {
  let crossFrameworkSetup: CrossFrameworkSetup;
  
  test.beforeAll(async ({ browser }) => {
    // Create separate browser instances for cross-framework testing
    const browser1 = browser;
    const browser2 = await browser.browserType().launch();
    
    crossFrameworkSetup = {
      browser1,
      browser2,
      context1: await browser1.newContext({
        storageState: {
          cookies: [],
          origins: [{
            origin: 'http://localhost:5174',
            localStorage: [
              { name: 'evolu_relay_url', value: 'ws://localhost:4000' },
              { name: 'evolu_user_id', value: 'react-user' }
            ]
          }]
        }
      }),
      context2: await browser2.newContext({
        storageState: {
          cookies: [],
          origins: [{
            origin: 'http://localhost:5175',
            localStorage: [
              { name: 'evolu_relay_url', value: 'ws://localhost:4000' },
              { name: 'evolu_user_id', value: 'svelte-user' }
            ]
          }]
        }
      }),
      reactPage: null as any,
      sveltePage: null as any,
    };
    
    crossFrameworkSetup.reactPage = await crossFrameworkSetup.context1.newPage();
    crossFrameworkSetup.sveltePage = await crossFrameworkSetup.context2.newPage();
  });

  test.afterAll(async () => {
    await crossFrameworkSetup.context1?.close();
    await crossFrameworkSetup.context2?.close();
    await crossFrameworkSetup.browser2?.close();
  });

  test.beforeEach(async () => {
    const { reactPage, sveltePage } = crossFrameworkSetup;
    
    // Navigate to different framework implementations
    await reactPage.goto('http://localhost:5174'); // React app
    await sveltePage.goto('http://localhost:5175'); // Svelte app
    
    // Wait for both apps to load
    await reactPage.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    await sveltePage.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    
    // Set up console monitoring
    reactPage.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('React Console error:', msg.text());
      }
    });
    
    sveltePage.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Svelte Console error:', msg.text());
      }
    });
  });

  test('should sync group creation from React to Svelte', async () => {
    const { reactPage, sveltePage } = crossFrameworkSetup;
    
    // React user creates a group
    await reactPage.locator('[data-testid="group-name-input"]').fill('React to Svelte Group');
    await reactPage.locator('[data-testid="create-group-button"]').click();
    await reactPage.waitForSelector('text=React to Svelte Group', { timeout: 10000 });
    
    // Generate invite in React
    await reactPage.locator('button:has-text("View Details")').first().click();
    await reactPage.waitForSelector('[data-testid="group-details"]');
    await reactPage.locator('[data-testid="generate-invite-button"]').click();
    
    const inviteCode = await reactPage.locator('[data-testid="invite-code-display"] code').textContent();
    await reactPage.locator('button:has-text("Close")').click();
    
    // Svelte user joins the group
    await sveltePage.locator('[data-testid="invite-code-input"]').fill(inviteCode!);
    await sveltePage.locator('[data-testid="join-group-button"]').click();
    
    // Verify Svelte can see and interact with React-created group
    await expect(sveltePage.locator('[data-testid="groups-list"]')).toContainText('React to Svelte Group', { timeout: 15000 });
    
    // Set as current in Svelte
    await sveltePage.locator('button:has-text("Set as Current")').first().click();
    await expect(sveltePage.locator('[data-testid="current-group"]')).toBeVisible();
    await expect(sveltePage.locator('[data-testid="current-group"]')).toContainText('Role: member');
    
    console.log('✅ React → Svelte group sync successful');
  });

  test('should sync group creation from Svelte to React', async () => {
    const { reactPage, sveltePage } = crossFrameworkSetup;
    
    // Svelte user creates a group
    await sveltePage.locator('[data-testid="group-name-input"]').fill('Svelte to React Group');
    await sveltePage.locator('[data-testid="create-group-button"]').click();
    await sveltePage.waitForSelector('text=Svelte to React Group', { timeout: 10000 });
    
    // Generate invite in Svelte
    await sveltePage.locator('button:has-text("View Details")').first().click();
    await sveltePage.waitForSelector('[data-testid="group-details"]');
    await sveltePage.locator('[data-testid="generate-invite-button"]').click();
    
    const inviteCode = await sveltePage.locator('[data-testid="invite-code-display"] code').textContent();
    await sveltePage.locator('button:has-text("Close")').click();
    
    // React user joins the group
    await reactPage.locator('[data-testid="invite-code-input"]').fill(inviteCode!);
    await reactPage.locator('[data-testid="join-group-button"]').click();
    
    // Verify React can see and interact with Svelte-created group
    await expect(reactPage.locator('[data-testid="groups-list"]')).toContainText('Svelte to React Group', { timeout: 15000 });
    
    // Set as current in React
    await reactPage.locator('button:has-text("Set as Current")').first().click();
    await expect(reactPage.locator('[data-testid="current-group"]')).toBeVisible();
    await expect(reactPage.locator('[data-testid="current-group"]')).toContainText('Role: member');
    
    console.log('✅ Svelte → React group sync successful');
  });

  test('should maintain consistent group state across frameworks', async () => {
    const { reactPage, sveltePage } = crossFrameworkSetup;
    
    // Create group in React
    await reactPage.locator('[data-testid="group-name-input"]').fill('Framework Consistency Test');
    await reactPage.locator('[data-testid="create-group-button"]').click();
    await reactPage.waitForSelector('text=Framework Consistency Test', { timeout: 10000 });
    
    // Get invite code
    await reactPage.locator('button:has-text("View Details")').first().click();
    await reactPage.locator('[data-testid="generate-invite-button"]').click();
    const inviteCode = await reactPage.locator('[data-testid="invite-code-display"] code').textContent();
    await reactPage.locator('button:has-text("Close")').click();
    
    // Svelte user joins
    await sveltePage.locator('[data-testid="invite-code-input"]').fill(inviteCode!);
    await sveltePage.locator('[data-testid="join-group-button"]').click();
    await sveltePage.waitForTimeout(5000);
    
    // Both set as current group
    await reactPage.locator('button:has-text("Set as Current")').first().click();
    await sveltePage.locator('button:has-text("Set as Current")').first().click();
    
    // Verify consistent member count in both frameworks
    await reactPage.locator('button:has-text("View Details")').first().click();
    const reactMembers = reactPage.locator('[data-testid="members-list"] [data-testid^="member-"]');
    await expect(reactMembers).toHaveCount(2, { timeout: 10000 });
    await reactPage.locator('button:has-text("Close")').click();
    
    await sveltePage.locator('button:has-text("View Details")').first().click();
    const svelteMembers = sveltePage.locator('[data-testid="members-list"] [data-testid^="member-"]');
    await expect(svelteMembers).toHaveCount(2, { timeout: 10000 });
    await sveltePage.locator('button:has-text("Close")').click();
    
    // Verify role consistency
    await expect(reactPage.locator('[data-testid="current-group"]')).toContainText('Role: admin');
    await expect(sveltePage.locator('[data-testid="current-group"]')).toContainText('Role: member');
    
    console.log('✅ Framework consistency validated');
  });

  test('should handle cross-framework invite generation and usage', async () => {
    const { reactPage, sveltePage } = crossFrameworkSetup;
    
    // React creates group and generates admin invite
    await reactPage.locator('[data-testid="group-name-input"]').fill('Cross Framework Invites');
    await reactPage.locator('[data-testid="create-group-button"]').click();
    await reactPage.waitForSelector('text=Cross Framework Invites', { timeout: 10000 });
    
    await reactPage.locator('button:has-text("View Details")').first().click();
    await reactPage.locator('[data-testid="invite-role-select"]').selectOption('admin');
    await reactPage.locator('[data-testid="generate-invite-button"]').click();
    
    const adminInvite = await reactPage.locator('[data-testid="invite-code-display"] code').textContent();
    
    // Generate member invite too
    await reactPage.locator('[data-testid="invite-role-select"]').selectOption('member');
    await reactPage.locator('[data-testid="generate-invite-button"]').click();
    const memberInvite = await reactPage.locator('[data-testid="invite-code-display"] code').textContent();
    
    await reactPage.locator('button:has-text("Close")').click();
    
    // Svelte user uses admin invite
    await sveltePage.locator('[data-testid="invite-code-input"]').fill(adminInvite!);
    await sveltePage.locator('[data-testid="join-group-button"]').click();
    await sveltePage.waitForTimeout(5000);
    
    await sveltePage.locator('button:has-text("Set as Current")').first().click();
    
    // Verify Svelte user got admin role from React-generated invite
    await expect(sveltePage.locator('[data-testid="current-group"]')).toContainText('Role: admin');
    
    // Now Svelte admin should be able to generate invites
    await sveltePage.locator('button:has-text("View Details")').first().click();
    await sveltePage.locator('[data-testid="generate-invite-button"]').click();
    
    const svelteGeneratedInvite = await sveltePage.locator('[data-testid="invite-code-display"] code').textContent();
    expect(svelteGeneratedInvite).toBeTruthy();
    expect(svelteGeneratedInvite!.length).toBeGreaterThan(10);
    
    console.log('✅ Cross-framework invite generation validated');
  });

  test('should maintain data integrity across framework boundaries', async () => {
    const { reactPage, sveltePage } = crossFrameworkSetup;
    
    // Test data integrity by performing complex operations across frameworks
    
    // 1. React creates group
    await reactPage.locator('[data-testid="group-name-input"]').fill('Data Integrity Test');
    await reactPage.locator('[data-testid="create-group-button"]').click();
    await reactPage.waitForSelector('text=Data Integrity Test', { timeout: 10000 });
    
    // 2. React generates invite
    await reactPage.locator('button:has-text("View Details")').first().click();
    await reactPage.locator('[data-testid="generate-invite-button"]').click();
    const inviteCode = await reactPage.locator('[data-testid="invite-code-display"] code').textContent();
    await reactPage.locator('button:has-text("Close")').click();
    
    // 3. Svelte joins
    await sveltePage.locator('[data-testid="invite-code-input"]').fill(inviteCode!);
    await sveltePage.locator('[data-testid="join-group-button"]').click();
    await sveltePage.waitForTimeout(5000);
    
    // 4. Both refresh their pages (simulates app restart)
    await reactPage.reload();
    await sveltePage.reload();
    
    await reactPage.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    await sveltePage.waitForSelector('[data-testid="groups-demo"]', { timeout: 15000 });
    
    // 5. Verify data persisted across framework boundaries and app restarts
    await expect(reactPage.locator('[data-testid="groups-list"]')).toContainText('Data Integrity Test', { timeout: 10000 });
    await expect(sveltePage.locator('[data-testid="groups-list"]')).toContainText('Data Integrity Test', { timeout: 10000 });
    
    // 6. Both can still set as current group
    await reactPage.locator('button:has-text("Set as Current")').first().click();
    await sveltePage.locator('button:has-text("Set as Current")').first().click();
    
    // 7. Verify roles persisted
    await expect(reactPage.locator('[data-testid="current-group"]')).toContainText('Role: admin');
    await expect(sveltePage.locator('[data-testid="current-group"]')).toContainText('Role: member');
    
    // 8. Verify member lists are consistent
    await reactPage.locator('button:has-text("View Details")').first().click();
    await expect(reactPage.locator('[data-testid="members-list"] [data-testid^="member-"]')).toHaveCount(2, { timeout: 10000 });
    await reactPage.locator('button:has-text("Close")').click();
    
    await sveltePage.locator('button:has-text("View Details")').first().click();
    await expect(sveltePage.locator('[data-testid="members-list"] [data-testid^="member-"]')).toHaveCount(2, { timeout: 10000 });
    await sveltePage.locator('button:has-text("Close")').click();
    
    console.log('✅ Data integrity across frameworks validated');
  });

  test('should validate framework-agnostic Protocol compatibility', async () => {
    const { reactPage, sveltePage } = crossFrameworkSetup;
    
    // This test validates that the underlying Evolu Protocol works
    // identically across React and Svelte implementations
    
    const errors: { react: string[], svelte: string[] } = { react: [], svelte: [] };
    
    reactPage.on('console', msg => {
      if (msg.type() === 'error') {
        errors.react.push(msg.text());
      }
    });
    
    sveltePage.on('console', msg => {
      if (msg.type() === 'error') {
        errors.svelte.push(msg.text());
      }
    });
    
    // Perform identical operations in both frameworks
    await Promise.all([
      // React operations
      reactPage.locator('[data-testid="group-name-input"]').fill('Protocol Test React')
        .then(() => reactPage.locator('[data-testid="create-group-button"]').click()),
      
      // Svelte operations  
      sveltePage.locator('[data-testid="group-name-input"]').fill('Protocol Test Svelte')
        .then(() => sveltePage.locator('[data-testid="create-group-button"]').click())
    ]);
    
    // Wait for operations to complete
    await reactPage.waitForSelector('text=Protocol Test React', { timeout: 10000 });
    await sveltePage.waitForSelector('text=Protocol Test Svelte', { timeout: 10000 });
    
    // Cross-invite to verify protocol compatibility
    await reactPage.locator('button:has-text("View Details")').first().click();
    await reactPage.locator('[data-testid="generate-invite-button"]').click();
    const reactInvite = await reactPage.locator('[data-testid="invite-code-display"] code').textContent();
    await reactPage.locator('button:has-text("Close")').click();
    
    await sveltePage.locator('button:has-text("View Details")').first().click();
    await sveltePage.locator('[data-testid="generate-invite-button"]').click();
    const svelteInvite = await sveltePage.locator('[data-testid="invite-code-display"] code').textContent();
    await sveltePage.locator('button:has-text("Close")').click();
    
    // Cross-join to test protocol compatibility
    await reactPage.locator('[data-testid="invite-code-input"]').fill(svelteInvite!);
    await reactPage.locator('[data-testid="join-group-button"]').click();
    
    await sveltePage.locator('[data-testid="invite-code-input"]').fill(reactInvite!);
    await sveltePage.locator('[data-testid="join-group-button"]').click();
    
    await reactPage.waitForTimeout(5000);
    await sveltePage.waitForTimeout(5000);
    
    // Verify cross-framework joining worked
    await expect(reactPage.locator('[data-testid="groups-list"]')).toContainText('Protocol Test Svelte');
    await expect(sveltePage.locator('[data-testid="groups-list"]')).toContainText('Protocol Test React');
    
    // Ensure no errors occurred during protocol operations
    expect(errors.react).toHaveLength(0);
    expect(errors.svelte).toHaveLength(0);
    
    console.log('✅ Framework-agnostic Protocol compatibility validated');
    console.log('✅ React ↔ Svelte Groups sync fully operational');
  });
});