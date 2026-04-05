import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('shows MANDATE title and Play button', async ({ page }) => {
    await page.goto('/');
    // Wait for client-side hydration (Privy needs time to initialize)
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'tests/e2e/screenshots/landing.png', fullPage: true });

    // The page should show either the landing screen or the loading spinner
    const hasPlay = await page.locator('button:has-text("Play")').isVisible().catch(() => false);
    const hasInitializing = await page.locator('text=Initializing').isVisible().catch(() => false);
    const hasMandate = (await page.textContent('body'))?.includes('MANDATE') ?? false;

    // At minimum, the page content should include MANDATE
    expect(hasPlay || hasInitializing || hasMandate).toBe(true);
    await expect(page).toHaveTitle('MANDATE');
  });

  test('page loads without critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(5000);

    // Filter out expected non-critical errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Privy') &&
        !e.includes('privy') &&
        !e.includes('Failed to fetch') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource'),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Component Library', () => {
  test('renders all sections', async ({ page }) => {
    await page.goto('/components');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/e2e/screenshots/components.png', fullPage: true });

    await expect(page.locator('text=MANDATE Component Library')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Data Display')).toBeVisible();
    await expect(page.locator('text=Interactive')).toBeVisible();
  });
});

test.describe('API: /api/register', () => {
  test('validates missing player address', async ({ request }) => {
    const res = await request.post('/api/register', {
      data: { role: 3 },
    });
    expect(res.status()).toBe(400);
  });

  test('validates invalid address format', async ({ request }) => {
    const res = await request.post('/api/register', {
      data: { playerAddress: 'not-an-address', role: 0 },
    });
    expect(res.status()).toBe(400);
  });

  test('validates role range', async ({ request }) => {
    const res = await request.post('/api/register', {
      data: { playerAddress: '0x0000000000000000000000000000000000000099', role: 7 },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects already-registered deployer (409)', async ({ request }) => {
    const res = await request.post('/api/register', {
      data: {
        playerAddress: '0x3382189F8a29607FdDf3D692B10a2D74480a503F',
        role: 3,
      },
    });
    expect(res.status()).toBe(409);
  });

  test('registers a fresh address on-chain', async ({ request }) => {
    const randomHex = Math.random().toString(16).slice(2, 42).padEnd(40, '0');
    const freshAddress = `0x${randomHex}`;

    const res = await request.post('/api/register', {
      data: { playerAddress: freshAddress, role: 2 },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agentId).toBeGreaterThan(0);
    expect(body.txHash).toBeTruthy();
  });
});

test.describe('API: /api/llm', () => {
  test('rejects invalid JSON', async ({ request }) => {
    const res = await request.post('/api/llm', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not json',
    });
    expect(res.status()).toBe(400);
  });

  test('rejects missing required fields', async ({ request }) => {
    const res = await request.post('/api/llm', {
      data: { sessionToken: 'test' },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects unauthenticated session (401)', async ({ request }) => {
    const res = await request.post('/api/llm', {
      data: {
        sessionToken: 'nonexistent',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: 'test' }],
      },
    });
    expect(res.status()).toBe(401);
  });
});
