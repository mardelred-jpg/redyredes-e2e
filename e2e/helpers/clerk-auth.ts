/**
 * Clerk Authentication Helper for Playwright
 *
 * Two paths:
 *   1. FAST (PAT-001B): Clerk Testing Token — bypasses UI, injects session
 *      Requires CLERK_TESTING_TOKEN env var.
 *      See: https://clerk.com/docs/testing/playwright/overview
 *
 *   2. REAL (PAT-001C): Full UI interaction — fills signup form in Clerk
 *      Validates the actual user-facing flow.
 */

import { Page, BrowserContext } from '@playwright/test';

const JOIN_URL = process.env.E2E_JOIN_URL!;
const DASHBOARD_URL = process.env.E2E_DASHBOARD_URL!;

// ── PAT-001B: Testing Token path ──────────────────────────────

/**
 * Signs up a new user via Clerk Testing Token.
 * Injects the token into the browser context so Clerk treats the user
 * as authenticated without needing to fill any UI forms.
 *
 * Returns the Clerk userId for the created test user.
 */
export type AuthContext = {
  mode: 'api' | 'ui';
  clerkUserId?: string;
};

export async function signUpWithTestingToken(
  context: BrowserContext,
  email: string,
  password: string
): Promise<AuthContext> {
  const token = process.env.CLERK_TESTING_TOKEN;

  if (!token) {
    console.log(
      'CLERK_TESTING_TOKEN not configured. Falling back to Clerk UI.'
    );
    const page = await context.newPage();
    await signUpViaClerkUI(page, email, password);
    await page.close();
    return { mode: 'ui' };
  }

  // Create user via Clerk Backend API
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) throw new Error('CLERK_SECRET_KEY is not set');

  const createRes = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clerkKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: [email],
      password,
      skip_password_checks: false,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Clerk user creation failed: ${JSON.stringify(err)}`);
  }

  const user: any = await createRes.json();
  const userId: string = user.id;

  // Create a session for this user using the testing token mechanism
  // The CLERK_TESTING_TOKEN is injected as a cookie that Clerk's SDK recognizes
  // in test mode, bypassing normal session validation.
  const page = await context.newPage();
  await page.goto(JOIN_URL);

  await context.addCookies([
    {
      name: '__clerk_testing_token',
      value: token,
      domain: new URL(JOIN_URL).hostname,
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'None',
    },
  ]);

  await page.close();
  return { mode: 'api', clerkUserId: userId };
}

// ── PAT-001C: Real Clerk UI path ──────────────────────────────

/**
 * Signs up a new user by interacting with the Clerk UI.
 * This is the "real" path — validates the UI that actual customers see.
 */
export async function signUpViaClerkUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto(JOIN_URL);

  // Wait for Clerk's SignUp component to render
  await page.waitForSelector('[data-clerk-component="signUp"]', {
    timeout: 15_000,
  });

  // Fill email field (Clerk renders a standard input)
  const emailInput = page.locator('input[name="emailAddress"], input[type="email"]').first();
  await emailInput.fill(email);

  // Click Continue to proceed to password step
  const continueBtn = page.locator('button:has-text("Continue"), button[data-localization-key="formButtonPrimary"]').first();
  await continueBtn.click();

  // Fill password
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 10_000 });
  await passwordInput.fill(password);

  // Accept terms if checkbox visible (Clerk's terms checkbox)
  const termsCheck = page.locator('input[name="__clerk_ticket"], label:has-text("I agree")').first();
  if (await termsCheck.isVisible()) {
    await termsCheck.check();
  }

  // Submit
  const submitBtn = page.locator('button[type="submit"], button:has-text("Continue")').last();
  await submitBtn.click();
}

/**
 * Signs in an existing user via Clerk's SignIn UI.
 */
export async function signInViaClerkUI(
  page: Page,
  email: string,
  password: string,
  targetUrl: string = DASHBOARD_URL
): Promise<void> {
  await page.goto(targetUrl);

  // Clerk will redirect to sign-in if not authenticated
  await page.waitForSelector('input[name="identifier"], input[type="email"]', {
    timeout: 15_000,
  });

  const emailInput = page.locator('input[name="identifier"], input[type="email"]').first();
  await emailInput.fill(email);

  const continueBtn = page.locator('button:has-text("Continue")').first();
  await continueBtn.click();

  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 10_000 });
  await passwordInput.fill(password);

  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  // Wait for redirect to dashboard
  await page.waitForURL(`${targetUrl}**`, { timeout: 20_000 });
}

/**
 * Signs out the current user by clicking the Clerk user button.
 */
export async function signOut(page: Page): Promise<void> {
  // Try Clerk's user button menu
  const userButton = page.locator('[data-clerk-component="userButton"], button[aria-label*="user"], button[aria-label*="cuenta"]').first();

  if (await userButton.isVisible()) {
    await userButton.click();
    const signOutBtn = page.locator('button:has-text("Sign out"), button:has-text("Cerrar sesión"), [data-clerk-user-button-action="signOut"]').first();
    await signOutBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await signOutBtn.click();
  } else {
    // Fallback: navigate to Clerk's signout endpoint
    await page.goto(`${JOIN_URL}/?signOut=true`);
  }
}
