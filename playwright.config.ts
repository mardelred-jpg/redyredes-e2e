import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load E2E-specific environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.e2e') });

const JOIN_URL = process.env.E2E_JOIN_URL || 'https://join.redyredes.com';
const DASHBOARD_URL = process.env.E2E_DASHBOARD_URL || 'https://dashboard.redyredes.com';

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Global test timeout
  timeout: 120_000,

  // Fail the build on CI if any test has 'test.only'
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 1 : 0,

  // Reporter: HTML + JSON for CI
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  // Full artifacts: trace, video, screenshot, HAR
  use: {
    // Base URL — each test sets its own when navigating across domains
    baseURL: JOIN_URL,

    // Trace: record on first retry (always in CI)
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',

    // Video: retain on failure (always on CI for audit evidence)
    video: process.env.CI ? 'on' : 'retain-on-failure',

    // Screenshots on failure
    screenshot: 'only-on-failure',

    // HAR recording for network inspection (Disabled to fix TS error)
    // recordHar: {
    //  path: 'test-results/network.har',
    //  mode: 'minimal',
    // },

    // Ignore HTTPS errors (Vercel preview deployments)
    ignoreHTTPSErrors: false,

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Locale
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  },

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Projects
  projects: [
    {
      // PAT-000: Smoke test — runs on every push, no auth needed
      name: 'PAT-000 — Smoke Test',
      testMatch: 'e2e/pat-000.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      // PAT-001B: Full browser journey with Clerk Testing Token
      name: 'PAT-001B — Customer Journey (Testing Token)',
      testMatch: 'e2e/pat-001b.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      // PAT-001C: Full browser journey with real Clerk UI
      name: 'PAT-001C — Customer Journey (Real Clerk UI)',
      testMatch: 'e2e/pat-001c.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
