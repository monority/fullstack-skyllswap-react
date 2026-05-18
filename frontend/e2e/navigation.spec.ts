import { test, expect } from '@playwright/test';

test.describe('Navigation et structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page se charge correctement', async ({ page }) => {
    await expect(page).toHaveTitle(/Skyllswap|Echange/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('toutes les sections principales sont visibles', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    // Le formulaire d'auth est visible
    const authForm = page.locator('.auth-form');
    await expect(authForm).toBeVisible();
  });

  test('accessibilite - elements focusables', async ({ page }) => {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });
});