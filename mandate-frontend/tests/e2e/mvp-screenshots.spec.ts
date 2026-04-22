import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const ROUTES: readonly [string, string][] = [
  ['/mvp', 'portfolio'],
  ['/mvp/mandate', 'mandate'],
  ['/mvp/events', 'events'],
  ['/mvp/leaderboard', 'leaderboard'],
];

test.describe('MVP screenshots', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const [route, name] of ROUTES) {
    test(`capture ${name}`, async ({ page }) => {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `tests/e2e/screenshots/mvp-${name}.png`,
        fullPage: true,
      });
    });
  }
});
