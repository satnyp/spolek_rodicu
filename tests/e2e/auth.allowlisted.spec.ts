import { test, expect } from '@playwright/test';

test('allowlisted user can login in E2E mode', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('e2e-email').fill('test@gvid.cz');
  await page.getByTestId('e2e-login').click();
  await expect(page.getByTestId('dashboard-root')).toBeVisible();
});
