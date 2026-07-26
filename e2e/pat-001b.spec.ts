import { test, expect } from '@playwright/test';
import { generateE2ECompany } from './helpers/e2e-data';
import { signUpWithTestingToken, signOut, signInViaClerkUI, AuthContext } from './helpers/clerk-auth';
import { verifyViaAPI, verifyTicketsViaAPI } from './helpers/api-verify';
import { verifyDbIntegrity, resetE2EDatabase, deleteClerkTestUser } from './helpers/db-verify';

const DASHBOARD_URL = process.env.E2E_DASHBOARD_URL || 'https://dashboard.redyredes.com';
let authContext: AuthContext | null = null;
let organizationId: string | null = null;

test.describe.serial('PAT-001B — Customer Journey (Testing Token)', () => {
  const testData = generateE2ECompany();

  test.beforeAll(async () => {
    console.log(`[PAT-001B] Starting run with sequence: ${testData.sequence}`);
    // Phase 0: Reset DB before starting to ensure clean state
    await resetE2EDatabase();
  });

  test.afterAll(async () => {
    // Cleanup the Clerk user created during the test
    if (authContext?.clerkUserId) {
      await deleteClerkTestUser(authContext.clerkUserId);
      console.log(`[PAT-001B] Cleaned up Clerk user: ${authContext.clerkUserId}`);
    }
  });

  test('Phase 1: Clerk signup (Testing Token)', async ({ context }) => {
    // Uses Clerk Testing Token to bypass UI and inject session cookie
    authContext = await signUpWithTestingToken(
      context,
      testData.administrator.email,
      testData.administrator.password
    );
    expect(authContext).toBeTruthy();
    if (authContext.mode === 'api') {
      expect(authContext.clerkUserId).toBeTruthy();
    }
  });

  test('Phase 2: Onboarding — Company form', async ({ page }) => {
    // We expect the user to be redirected to /company upon first visit since they have no org
    await page.goto('/');
    await page.waitForURL('**/company**');

    await expect(page.locator('h1')).toContainText('preparar tu entorno');

    await page.fill('input[placeholder="Ej. Acme Corp"]', testData.company.name);
    await page.fill('input[placeholder="Ej. B12345678"]', testData.company.cif);
    
    // Address autocomplete handling (mock or direct fill depending on UI behavior)
    // For this test, we assume direct fill works or we type and select the first option
    const addressInput = page.locator('input[placeholder="Calle Principal 123"]');
    await addressInput.fill(testData.company.address);

    await page.fill('input[placeholder="28001"]', testData.company.postalCode);
    
    // Wait for the postal code check to finish and populate city/province
    await page.waitForTimeout(1000); // Give it a moment for the API call

    // If city is a select (multiple options), select the first one. Otherwise, it's auto-filled.
    const citySelect = page.locator('select').first();
    if (await citySelect.isVisible()) {
      await citySelect.selectOption({ index: 1 });
    }

    // Submit by pressing Enter or clicking Continue
    await page.keyboard.press('Enter');
    await page.waitForURL('**/users**');
  });

  test('Phase 3: Onboarding — Users form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('el equipo');

    // Name and email might be pre-filled from Clerk, but we ensure they match
    await page.fill('input[placeholder="Ej. Juan"]', testData.administrator.firstName);
    await page.fill('input[placeholder="Ej. Pérez"]', testData.administrator.lastName);
    
    // Select number of employees (assuming it's a select or radio buttons)
    // Let's assume there's a button for "1-10" or similar
    const empButton = page.locator('button:has-text("1-10"), label:has-text("1-10")').first();
    if (await empButton.isVisible()) {
      await empButton.click();
    }

    const continueBtn = page.locator('button:has-text("Continuar")');
    await continueBtn.click();
    await page.waitForURL('**/services**');
  });

  test('Phase 4: Onboarding — Services', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('servicios');

    // Select Hardware and Network
    const hardwareCard = page.locator('div').filter({ hasText: 'Hardware' }).first();
    if (await hardwareCard.isVisible()) await hardwareCard.click();

    const networkCard = page.locator('div').filter({ hasText: 'Red' }).first();
    if (await networkCard.isVisible()) await networkCard.click();

    const continueBtn = page.locator('button:has-text("Continuar")');
    await continueBtn.click();
    await page.waitForURL('**/formalization**');
  });

  test('Phase 5: Onboarding — Formalization + /api/join', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Formalización');

    // Accept terms
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    // Intercept the /api/join call to capture the organizationId
    const joinPromise = page.waitForResponse(response => 
      response.url().includes('/api/join') && response.status() === 200
    );

    const acceptBtn = page.locator('button:has-text("Aceptar")');
    await acceptBtn.click();

    const joinResponse = await joinPromise;
    const joinData = await joinResponse.json();
    
    expect(joinData.success).toBe(true);
    expect(joinData.organizationId).toBeTruthy();
    organizationId = joinData.organizationId;

    // Wait for redirect to completed or dashboard
    await page.waitForURL(/completed|dashboard/);
  });

  test('Phase 6: Dashboard hydration + workspace', async ({ page }) => {
    // Navigate explicitly to dashboard URL to verify cross-domain session if applicable
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    // Verify org name is displayed
    await expect(page.locator('body')).toContainText(testData.company.name);
  });

  test('Phase 7: Create ticket', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/tickets/create`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="title"], input[placeholder*="título" i]', 'E2E Test Ticket');
    await page.fill('textarea[name="description"], textarea[placeholder*="descripción" i]', 'This is an automated test ticket generated by PAT-001B.');
    
    // Select category and priority if applicable
    const categorySelect = page.locator('select[name="category"]').first();
    if (await categorySelect.isVisible()) await categorySelect.selectOption({ index: 1 });

    const prioritySelect = page.locator('select[name="priority"]').first();
    if (await prioritySelect.isVisible()) await prioritySelect.selectOption({ index: 1 });

    const submitBtn = page.locator('button[type="submit"], button:has-text("Crear")');
    await submitBtn.click();

    // Verify redirection to tickets list or ticket detail
    await page.waitForURL(/tickets/);
    await expect(page.locator('body')).toContainText('E2E Test Ticket');
  });

  test('Phase 8: Logout', async ({ page }) => {
    await signOut(page);
    // Should be redirected to Clerk login/signup
    await page.waitForURL(/accounts|sign-in/);
  });

  test('Phase 9: Re-login + data consistency', async ({ page }) => {
    // Login again via UI to ensure the credentials work
    await signInViaClerkUI(page, testData.administrator.email, testData.administrator.password, DASHBOARD_URL);

    // Verify dashboard loads correctly
    await expect(page.locator('body')).toContainText(testData.company.name);

    // Verify ticket is still there
    await page.goto(`${DASHBOARD_URL}/tickets`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText('E2E Test Ticket');
  });

  test('Phase 10a: API verification', async ({ page }) => {
    expect(organizationId).toBeTruthy();
    // Validate the API stack using the active session cookies
    const apiResult = await verifyViaAPI(page);
    
    expect(apiResult.identity.organizationId).toBe(organizationId);
    expect(apiResult.debugMe.customerFound).toBe(true);
    expect(apiResult.debugMe.organizationId).toBe(organizationId);
    
    await verifyTicketsViaAPI(page, 1); // Expect at least 1 ticket (the one we created)
  });

  test('Phase 10b: DB integrity + PRODUCTION isolation guard', async () => {
    expect(organizationId).toBeTruthy();
    expect(authContext).toBeTruthy();

    const dbReport = await verifyDbIntegrity(organizationId!, authContext!);
    
    if (authContext!.mode === 'ui') {
      authContext!.clerkUserId = dbReport.customer.id;
    }
    
    expect(dbReport.organization.environment).toBe('E2E');
    expect(dbReport.customer.organizationId).toBe(organizationId);
    expect(dbReport.subscription.status).toBe('TRIALING');
    
    // The most critical assertion: no test data leaked into PRODUCTION
    expect(dbReport.productionIsolation.noProductionOrgHasE2EEmail).toBe(true);
    expect(dbReport.productionIsolation.noE2EOrgExistsWithProductionEnv).toBe(true);
  });
});
