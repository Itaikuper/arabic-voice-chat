import { test, expect } from '@playwright/test';

test.describe('Character Selection', () => {
  test('should display character selection screen after API key entry', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Should show character selection screen
    await expect(page.locator('h1')).toContainText('Choose Your Conversation Partner');
    await expect(page.locator('text=اختار مين بدك تحكي معه')).toBeVisible();
  });

  test('should display all three character cards', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Check for Ahmed
    await expect(page.locator('text=Ahmed')).toBeVisible();
    await expect(page.locator('text=أحمد')).toBeVisible();
    await expect(page.locator('text=Friendly young teacher who loves helping people learn')).toBeVisible();

    // Check for Layla
    await expect(page.locator('text=Layla')).toBeVisible();
    await expect(page.locator('text=ليلى')).toBeVisible();
    await expect(page.locator('text=Warm shopkeeper who knows everyone in the neighborhood')).toBeVisible();

    // Check for Omar
    await expect(page.locator('text=Omar')).toBeVisible();
    await expect(page.locator('text=عمر')).toBeVisible();
    await expect(page.locator('text=Wise elderly storyteller with a great sense of humor')).toBeVisible();
  });

  test('should display gender badges for characters', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Check for male badges (Ahmed and Omar)
    const maleBadges = page.locator('text=👨 Male');
    await expect(maleBadges).toHaveCount(2);

    // Check for female badge (Layla)
    const femaleBadge = page.locator('text=👩 Female');
    await expect(femaleBadge).toHaveCount(1);
  });

  test('should have Start Conversation buttons for all characters', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Check for Start Conversation buttons
    const startButtons = page.locator('button:has-text("Start Conversation")');
    await expect(startButtons).toHaveCount(3);
  });

  test('should have back button to return to API key entry', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Check for back button
    const backButton = page.locator('button:has-text("Back to API Key")');
    await expect(backButton).toBeVisible();
  });

  test('should navigate back to API key entry when back button is clicked', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Click back button
    await page.locator('button:has-text("Back to API Key")').click();

    // Should be back on API key entry screen
    await expect(page.locator('h1')).toContainText('Arabic Voice Chat');
    await expect(page.locator('#apiKey')).toBeVisible();
  });

  test('should navigate to voice chat when character is selected', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Select Ahmed character using aria-label
    await page.locator('button[aria-label="Select Ahmed"]').click();

    // Should show voice chat with Ahmed
    await page.waitForTimeout(500);
    await expect(page.locator('h1')).toContainText('Ahmed');
    await expect(page.locator('text=أحمد')).toBeVisible();
  });

  test('should display change character button in voice chat', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Select Layla character using aria-label
    await page.locator('button[aria-label="Select Layla"]').click();

    // Should show change character button
    await page.waitForTimeout(500);
    const changeButton = page.locator('button:has-text("Change Character")');
    await expect(changeButton).toBeVisible();
  });

  test('should return to character selection when change character button is clicked', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Select Omar character using aria-label
    await page.locator('button[aria-label="Select Omar"]').click();

    // Wait for voice chat to load
    await page.waitForTimeout(500);

    // Click change character button
    await page.locator('button:has-text("Change Character")').click();

    // Should be back on character selection
    await expect(page.locator('h1')).toContainText('Choose Your Conversation Partner');
    await expect(page.locator('text=Ahmed')).toBeVisible();
  });

  test('should have responsive grid layout for character cards', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Check for grid container
    const gridContainer = page.locator('.grid');
    await expect(gridContainer).toBeVisible();

    // Check that cards are properly styled
    const characterCards = page.locator('.bg-white.rounded-2xl.shadow-lg');
    await expect(characterCards).toHaveCount(3);
  });

  test('should display character avatars as emojis', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Enter valid API key
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Check for avatar emojis (they should be displayed with text-7xl class)
    const avatars = page.locator('.text-7xl');
    await expect(avatars).toHaveCount(3);
  });
});
