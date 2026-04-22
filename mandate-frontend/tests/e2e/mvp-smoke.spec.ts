import { test, expect, type ConsoleMessage } from '@playwright/test';

const BASE = 'http://localhost:3000';
const ROUTES = ['/mvp', '/mvp/mandate', '/mvp/events', '/mvp/leaderboard'];

test.describe('MVP smoke', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const route of ROUTES) {
    test(`${route} loads without hydration errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (text.includes('Hydration') || text.includes('hydration') || text.includes("didn't match")) {
            errors.push(`console.error: ${text}`);
          }
        }
      });

      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle' });
      expect(resp?.status()).toBe(200);

      // Allow client to finish rendering
      await page.waitForTimeout(1500);

      expect(errors, errors.join('\n')).toHaveLength(0);
    });
  }

  test('tab bar is visible and navigates between screens', async ({ page }) => {
    await page.goto(BASE + '/mvp', { waitUntil: 'networkidle' });
    const tabBar = page.locator('nav').last();
    await expect(tabBar.getByRole('link', { name: 'Portfolio', exact: true })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Mandate', exact: true })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Events', exact: true })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Standings', exact: true })).toBeVisible();

    await tabBar.getByRole('link', { name: 'Mandate', exact: true }).click();
    await expect(page).toHaveURL(/\/mvp\/mandate$/);
    await expect(page.getByRole('button', { name: /Deploy mandate|Mandate active/i })).toBeVisible();
  });

  test('portfolio shows epoch countdown in expected format', async ({ page }) => {
    await page.goto(BASE + '/mvp', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const timer = page.locator('text=EPOCH ENDS IN').locator('..').locator('span').last();
    await expect(timer).toBeVisible();
    const text = await timer.textContent();
    expect(text).toMatch(/(\d+d \d+h \d+m|\d+h \d+m|\d+m|—)/);
  });

  test('mandate editor accepts text up to 500 chars and saves', async ({ page }) => {
    await page.goto(BASE + '/mvp/mandate', { waitUntil: 'networkidle' });
    const textarea = page.locator('textarea');
    await textarea.fill('Buy CHIPS when cheap. Hold COMPUTE. Sell DATA opportunistically.');
    await page.getByRole('button', { name: /Deploy mandate/i }).click();
    await expect(page.getByRole('button', { name: /Deployed|Mandate active/i })).toBeVisible();
  });
});
