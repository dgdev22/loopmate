import { test, expect, Page } from '@playwright/test';

/**
 * Helper function to wait until Electron app is fully loaded
 */
async function waitForAppReady(page: Page) {
  // In E2E we run the renderer in a browser context (NODE_ENV=test),
  // so window.electronAPI may not exist. Wait for React UI instead.
  await page.waitForSelector('[data-testid="app-title"]', { timeout: 20000 });
}

test.describe('Electron App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for app to load
    await page.goto('http://localhost:5173');
    await waitForAppReady(page);
  });

  /**
   * Test A: App Launch & Basic UI
   */
  test('should launch app and display main UI elements', async ({ page }) => {
    // Check window title
    await expect(page).toHaveTitle(/LoopMate/i);
    
    // Check header
    await expect(page.locator('[data-testid="app-title"]')).toBeVisible();
    
    // Check main tab menu
    const imageMusicTab = page.locator('[data-testid="menu-image-music"]');
    const loopTab = page.locator('[data-testid="menu-loop"]');
    const concatTab = page.locator('[data-testid="menu-concat"]');
    const settingsTab = page.locator('[data-testid="menu-settings"]');
    
    await expect(imageMusicTab).toBeVisible();
    await expect(loopTab).toBeVisible();
    await expect(concatTab).toBeVisible();
    await expect(settingsTab).toBeVisible();
    
    // "Image + Music" tab should be selected by default
    await expect(page.locator('[data-testid="tab-image-music"]')).toBeVisible();
  });

  /**
   * Test B: Navigation
   */
  test('should navigate between tabs', async ({ page }) => {
    // Click Settings tab
    const settingsTab = page.locator('[data-testid="menu-settings"]');
    await settingsTab.click();
    
    // Check if Settings content is displayed
    await expect(page.locator('[data-testid="tab-settings"]')).toBeVisible({ timeout: 5000 });
    
    // Go back to "Image + Music" tab
    const imageMusicTab = page.locator('[data-testid="menu-image-music"]');
    await imageMusicTab.click();
    
    // Check if main view is displayed again
    await expect(page.locator('[data-testid="tab-image-music"]')).toBeVisible({ timeout: 5000 });
  });

  /**
   * Test C: Settings Tab Content
   */
  test('should display Settings tab content correctly', async ({ page }) => {
    // Click Settings tab
    const settingsTab = page.locator('[data-testid="menu-settings"]');
    await settingsTab.click();
    
    // Check Settings tab content
    await expect(page.locator('[data-testid="tab-settings"]')).toBeVisible();
  });

  /**
   * Test D: Apply Intro/Outro Checkbox
   */
  test('should switch to Settings tab from main tabs', async ({ page }) => {
    await page.locator('[data-testid="menu-settings"]').click();
    await expect(page.locator('[data-testid="tab-settings"]')).toBeVisible();
  });

  /**
   * Test E: Tab Switching
   */
  test('should switch between all tabs correctly', async ({ page }) => {
    const tabs = [
      { menuTestId: 'menu-image-music', contentTestId: 'tab-image-music' },
      { menuTestId: 'menu-loop', contentTestId: 'tab-loop' },
      { menuTestId: 'menu-concat', contentTestId: 'tab-concat' },
      { menuTestId: 'menu-settings', contentTestId: 'tab-settings' },
    ];

    for (const tab of tabs) {
      const tabButton = page.locator(`[data-testid="${tab.menuTestId}"]`);
      await tabButton.click();
      
      // Check if unique content for each tab is displayed
      await expect(page.locator(`[data-testid="${tab.contentTestId}"]`)).toBeVisible({ timeout: 5000 });
    }
  });
});

