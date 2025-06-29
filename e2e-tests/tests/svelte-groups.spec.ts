import { test, expect } from '@playwright/test';

test.describe('Svelte Groups Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForSelector('[data-testid="groups-demo"]', { timeout: 10000 });
    
    // Check console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });
  });

  test('should display groups demo section', async ({ page }) => {
    const groupsDemo = page.locator('[data-testid="groups-demo"]');
    await expect(groupsDemo).toBeVisible();
    
    // Check main sections are present
    await expect(page.locator('h3:has-text("Current Group Context")')).toBeVisible();
    await expect(page.locator('h3:has-text("Create New Group")')).toBeVisible();
    await expect(page.locator('h3:has-text("Join Group")')).toBeVisible();
    await expect(page.locator('h3:has-text("My Groups")')).toBeVisible();
  });

  test('should show no current group initially', async ({ page }) => {
    const noCurrentGroup = page.locator('[data-testid="no-current-group"]');
    await expect(noCurrentGroup).toBeVisible();
    await expect(noCurrentGroup).toHaveText('No group context selected');
  });

  test('should create a new group', async ({ page }) => {
    // Enter group name
    const groupNameInput = page.locator('[data-testid="group-name-input"]');
    await groupNameInput.fill('Svelte Test Group 1');
    
    // Click create button
    const createButton = page.locator('[data-testid="create-group-button"]');
    await createButton.click();
    
    // Wait for group to appear in the list
    await page.waitForSelector('[data-testid="groups-list"]', { timeout: 5000 });
    
    // Verify group was created
    const groupsList = page.locator('[data-testid="groups-list"]');
    await expect(groupsList).toContainText('Svelte Test Group 1');
    
    // Verify no error message
    const createError = page.locator('[data-testid="create-error"]');
    await expect(createError).not.toBeVisible();
  });

  test('should create multiple groups', async ({ page }) => {
    // Create first group
    await page.locator('[data-testid="group-name-input"]').fill('Svelte Alpha');
    await page.locator('[data-testid="create-group-button"]').click();
    
    // Wait for first group to appear
    await page.waitForSelector('text=Svelte Alpha', { timeout: 5000 });
    
    // Create second group
    await page.locator('[data-testid="group-name-input"]').fill('Svelte Beta');
    await page.locator('[data-testid="create-group-button"]').click();
    
    // Wait for second group to appear
    await page.waitForSelector('text=Svelte Beta', { timeout: 5000 });
    
    // Verify both groups are in the list
    const groupsList = page.locator('[data-testid="groups-list"]');
    await expect(groupsList).toContainText('Svelte Alpha');
    await expect(groupsList).toContainText('Svelte Beta');
  });

  test('should set current group context', async ({ page }) => {
    // Create a group first
    await page.locator('[data-testid="group-name-input"]').fill('Svelte Context Group');
    await page.locator('[data-testid="create-group-button"]').click();
    
    // Wait for group to appear
    await page.waitForSelector('text=Svelte Context Group', { timeout: 5000 });
    
    // Click "Set as Current" button
    const setContextButton = page.locator('button:has-text("Set as Current")').first();
    await setContextButton.click();
    
    // Verify current group is displayed
    const currentGroup = page.locator('[data-testid="current-group"]');
    await expect(currentGroup).toBeVisible();
    await expect(currentGroup).toContainText('Group ID:');
    await expect(currentGroup).toContainText('Role: admin');
    
    // Verify button changed to "Current"
    const currentButton = page.locator('button:has-text("Current")').first();
    await expect(currentButton).toBeVisible();
    await expect(currentButton).toHaveClass(/active/);
  });

  test('should clear current group context', async ({ page }) => {
    // Create and set a group as current
    await page.locator('[data-testid="group-name-input"]').fill('Svelte Clear Group');
    await page.locator('[data-testid="create-group-button"]').click();
    await page.waitForSelector('text=Svelte Clear Group', { timeout: 5000 });
    await page.locator('button:has-text("Set as Current")').first().click();
    
    // Verify current group is set
    await expect(page.locator('[data-testid="current-group"]')).toBeVisible();
    
    // Clear the context
    await page.locator('button:has-text("Clear Context")').click();
    
    // Verify no current group
    await expect(page.locator('[data-testid="no-current-group"]')).toBeVisible();
  });

  test('should view group details', async ({ page }) => {
    // Create a group
    await page.locator('[data-testid="group-name-input"]').fill('Svelte Details Group');
    await page.locator('[data-testid="create-group-button"]').click();
    await page.waitForSelector('text=Svelte Details Group', { timeout: 5000 });
    
    // Click View Details
    await page.locator('button:has-text("View Details")').first().click();
    
    // Wait for details modal
    const groupDetails = page.locator('[data-testid="group-details"]');
    await expect(groupDetails).toBeVisible();
    
    // Verify details content
    await expect(groupDetails).toContainText('Group: Svelte Details Group');
    await expect(groupDetails).toContainText('ID:');
    await expect(groupDetails).toContainText('Created:');
    await expect(groupDetails).toContainText('Current Epoch: 1');
    
    // Check members list
    const membersList = page.locator('[data-testid="members-list"]');
    await expect(membersList).toBeVisible();
    // Should have at least the creator as admin
    await expect(membersList).toContainText('admin');
    
    // Close details
    await page.locator('button:has-text("Close")').click();
    await expect(groupDetails).not.toBeVisible();
  });

  test('should generate invite code', async ({ page }) => {
    // Create a group
    await page.locator('[data-testid="group-name-input"]').fill('Svelte Invite Group');
    await page.locator('[data-testid="create-group-button"]').click();
    await page.waitForSelector('text=Svelte Invite Group', { timeout: 5000 });
    
    // Open group details
    await page.locator('button:has-text("View Details")').first().click();
    await page.waitForSelector('[data-testid="group-details"]');
    
    // Select member role
    const roleSelect = page.locator('[data-testid="invite-role-select"]');
    await roleSelect.selectOption('member');
    
    // Generate invite
    await page.locator('[data-testid="generate-invite-button"]').click();
    
    // Wait for invite code
    const inviteCodeDisplay = page.locator('[data-testid="invite-code-display"]');
    await expect(inviteCodeDisplay).toBeVisible({ timeout: 5000 });
    
    // Verify invite code format (should be base64url)
    const inviteCode = await inviteCodeDisplay.locator('code').textContent();
    expect(inviteCode).toBeTruthy();
    expect(inviteCode?.length).toBeGreaterThan(10);
    expect(inviteCode).toMatch(/^[A-Za-z0-9_-]+$/); // Base64url pattern
  });

  test('should handle join group with invalid code', async ({ page }) => {
    // Try to join with invalid code
    await page.locator('[data-testid="invite-code-input"]').fill('invalid-svelte-code');
    await page.locator('[data-testid="join-group-button"]').click();
    
    // Wait for error
    const joinError = page.locator('[data-testid="join-error"]');
    await expect(joinError).toBeVisible({ timeout: 5000 });
    await expect(joinError).toContainText('Failed to join group');
  });

  test('should handle empty group name', async ({ page }) => {
    // Try to create with empty name
    const createButton = page.locator('[data-testid="create-group-button"]');
    
    // Button should be disabled when input is empty
    await expect(createButton).toBeDisabled();
    
    // Type and clear
    const input = page.locator('[data-testid="group-name-input"]');
    await input.fill('Test');
    await expect(createButton).not.toBeDisabled();
    
    await input.clear();
    await expect(createButton).toBeDisabled();
  });

  test('should handle reactive state updates', async ({ page }) => {
    // Create a group
    await page.locator('[data-testid="group-name-input"]').fill('Svelte Reactive Group');
    await page.locator('[data-testid="create-group-button"]').click();
    await page.waitForSelector('text=Svelte Reactive Group', { timeout: 5000 });
    
    // Test reactive updates by setting and clearing current group
    const setButton = page.locator('button:has-text("Set as Current")').first();
    await setButton.click();
    
    // Verify reactive update
    const currentButton = page.locator('button:has-text("Current")').first();
    await expect(currentButton).toBeVisible();
    await expect(page.locator('[data-testid="current-group"]')).toBeVisible();
    
    // Clear and verify reactive update
    await page.locator('button:has-text("Clear Context")').click();
    const setAsCurrentButton = page.locator('button:has-text("Set as Current")').first();
    await expect(setAsCurrentButton).toBeVisible();
    await expect(page.locator('[data-testid="no-current-group"]')).toBeVisible();
  });

  test('should generate invite with admin role', async ({ page }) => {
    // Create a group
    await page.locator('[data-testid="group-name-input"]').fill('Svelte Admin Group');
    await page.locator('[data-testid="create-group-button"]').click();
    await page.waitForSelector('text=Svelte Admin Group', { timeout: 5000 });
    
    // Open group details
    await page.locator('button:has-text("View Details")').first().click();
    await page.waitForSelector('[data-testid="group-details"]');
    
    // Select admin role
    await page.locator('[data-testid="invite-role-select"]').selectOption('admin');
    
    // Generate invite
    await page.locator('[data-testid="generate-invite-button"]').click();
    
    // Verify invite was generated
    await expect(page.locator('[data-testid="invite-code-display"]')).toBeVisible({ timeout: 5000 });
  });

  test('svelte groups functionality works without errors', async ({ page }) => {
    const errors: string[] = [];
    
    // Capture any console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Perform various operations
    await page.locator('[data-testid="group-name-input"]').fill('Svelte Error Test');
    await page.locator('[data-testid="create-group-button"]').click();
    await page.waitForSelector('text=Svelte Error Test', { timeout: 5000 });
    
    await page.locator('button:has-text("Set as Current")').first().click();
    await page.locator('button:has-text("View Details")').first().click();
    await page.waitForSelector('[data-testid="group-details"]');
    
    // Wait a bit to catch any async errors
    await page.waitForTimeout(2000);
    
    // Verify no errors occurred
    expect(errors).toHaveLength(0);
  });
});