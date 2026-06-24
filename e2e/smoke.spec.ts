import { test, expect } from '@playwright/test';

test('smoke: web app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=ManageYourLLM')).toBeVisible();
});
