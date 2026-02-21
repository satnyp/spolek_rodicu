import { test, expect } from '@playwright/test';

test('non-allowlisted user is denied access', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('e2e-email').fill('not-allowlisted@gvid.cz');
  await page.getByTestId('e2e-login').click();
  await expect(page.getByTestId('access-denied')).toBeVisible();
});
