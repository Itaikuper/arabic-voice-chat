import { test, expect } from '@playwright/test';

test.describe('Arabic Voice Chat Application', () => {
  test('should display landing page with API key form', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check page title
    await expect(page.locator('h1')).toContainText('Arabic Voice Chat');
    await expect(page.locator('text=Real-time conversation in Palestinian Arabic')).toBeVisible();

    // Check API key input
    await expect(page.locator('#apiKey')).toBeVisible();
    await expect(page.locator('label[for="apiKey"]')).toContainText('Google Gemini API Key');

    // Check submit button
    await expect(page.locator('button[type="submit"]')).toContainText('Start Conversation');

    // Check instructions
    await expect(page.locator('text=How to get your API key:')).toBeVisible();
    await expect(page.locator('text=Google AI Studio')).toBeVisible();

    // Check security note
    await expect(page.locator('text=Security Note:')).toBeVisible();
  });

  test('should validate API key format', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Try to submit empty form
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Please enter a valid API key')).toBeVisible();

    // Try invalid API key format
    await page.locator('#apiKey').fill('invalid-key');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Please enter a valid API key')).toBeVisible();
  });

  test('should hide error message when typing', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Trigger error
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Please enter a valid API key')).toBeVisible();

    // Start typing
    await page.locator('#apiKey').fill('AIza');
    await expect(page.locator('text=Please enter a valid API key')).not.toBeVisible();
  });

  test('should accept valid API key format', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Fill in valid API key format (mock)
    await page.locator('#apiKey').fill('AIzaSyDummyKeyForTesting123456789');
    await page.locator('button[type="submit"]').click();

    // Should attempt to load voice chat (will fail without real API key, but that's OK)
    // We're just testing the UI validation
    await page.waitForTimeout(500);

    // The form should have been submitted (no validation error)
    await expect(page.locator('text=Please enter a valid API key')).not.toBeVisible();
  });

  test('should have proper responsive design', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check that the form container exists
    const container = page.locator('.max-w-md.bg-white.rounded-2xl');
    await expect(container).toBeVisible();

    // Check that buttons are clickable
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
  });

  test('should have proper accessibility', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check that input has label
    const apiKeyLabel = page.locator('label[for="apiKey"]');
    await expect(apiKeyLabel).toBeVisible();

    // Check that input has proper type
    const input = page.locator('#apiKey');
    await expect(input).toHaveAttribute('type', 'password');

    // Check that input has placeholder
    await expect(input).toHaveAttribute('placeholder', 'AIza...');
  });
});
