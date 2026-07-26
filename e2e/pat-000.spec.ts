import { test, expect } from '@playwright/test';

/**
 * PAT-000 — Smoke Test
 *
 * Validates that the RedyRedes platform is UP and operational.
 * Runs on EVERY push to every branch.
 *
 * Target: fast (< 60s), no auth required, no browser interaction.
 * Failure means the platform is DOWN — all other tests are blocked.
 */

const API_URL = process.env.E2E_API_URL || 'https://api.redyredes.com';
const JOIN_URL = process.env.E2E_JOIN_URL || 'https://join.redyredes.com';
const DASHBOARD_URL = process.env.E2E_DASHBOARD_URL || 'https://dashboard.redyredes.com';

test.describe('PAT-000 — Smoke Test', () => {

  // ── API Layer ──────────────────────────────────────────────

  test('API: /api/live responds 200', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/live`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('API: /api/ready responds 200', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/ready`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('API: /api/health returns DB = UP', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/health`);
    // Accept 200 (UP) or 200 with DEGRADED (non-DB services down)
    // 503 means DB is DOWN — hard failure
    expect(res.status(), '/api/health must not return 503 (DB DOWN)').not.toBe(503);
    const body = await res.json();
    expect(
      body.checks?.database,
      'Database must be UP'
    ).toBe('UP');
  });

  // ── Web Layer ──────────────────────────────────────────────

  test('Onboarding: join.redyredes.com is reachable', async ({ page }) => {
    const res = await page.goto(JOIN_URL);
    expect(res?.status(), 'Onboarding must return HTTP 200').toBe(200);
    // Clerk should load — verify the page is not a 404/500 shell
    const title = await page.title();
    expect(title, 'Onboarding page should have a title').toBeTruthy();
  });

  test('Dashboard: dashboard.redyredes.com is reachable', async ({ page }) => {
    const res = await page.goto(DASHBOARD_URL);
    // Redirect to Clerk login is acceptable (302/200)
    expect(
      res?.status(),
      'Dashboard must be reachable (200 or redirect)'
    ).toBeLessThan(500);
  });

});
