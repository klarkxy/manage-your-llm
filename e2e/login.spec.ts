// Smoke test: the admin login flow renders the dashboard and the Usage
// page loads through the new usage aggregation API.
//
// Run with `pnpm e2e`. The Playwright config boots the api + web dev
// servers with MODELHARBOR_PORT pointing at a temp sqlite database so the
// run is hermetic. The default admin is bootstrapped from env on startup.

import { expect, test } from '@playwright/test';

async function fillLoginForm(
  page: import('@playwright/test').Page,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill('admin');
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// Wait for the auth store to finish its /me round-trip and the router to
// leave /login. Used only on the success path; the wrong-password test
// does not call this so it does not block waiting for a redirect that
// will never happen.
async function waitForOverview(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForURL(/\/$/, { timeout: 15_000 });
}

test('admin can sign in and reach the Overview page', async ({ page }) => {
  await fillLoginForm(page, 'change-me-on-first-run');
  await waitForOverview(page);
  // The Overview page shows the four summary cards (Apps, Public models,
  // Model groups, Upstream keys). Upstream keys is the last one and
  // appears on every freshly bootstrapped install regardless of data.
  await expect(page.getByText('Upstream keys').first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/$/);
});

test('wrong password shows the inline error', async ({ page }) => {
  await fillLoginForm(page, 'definitely-wrong');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Invalid username or password')).toBeVisible();
});

test('Usage page renders the empty state when there is no traffic', async ({ page }) => {
  await fillLoginForm(page, 'change-me-on-first-run');
  await waitForOverview(page);
  await page.goto('/usage');
  await expect(page.getByText('Usage overview')).toBeVisible({ timeout: 15_000 });
  // The four breakdown cards are always present (zero-row state is fine).
  // Match the card title text exactly: the dropdown selector labels share
  // the "By app" / "By consumer key" / etc. prefix with the card titles
  // ("Requests by app (top 8)"), so a substring match resolves to two
  // elements under Playwright's strict mode.
  await expect(page.getByText('By app', { exact: true })).toBeVisible();
  await expect(page.getByText('By consumer key', { exact: true })).toBeVisible();
  await expect(page.getByText('By upstream key', { exact: true })).toBeVisible();
  await expect(page.getByText('By target', { exact: true })).toBeVisible();
});
