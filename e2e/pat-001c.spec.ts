import { test, expect } from '@playwright/test';
import { generateE2ECompany } from './helpers/e2e-data';
import { signUpViaClerkUI } from './helpers/clerk-auth';
import { resetE2EDatabase, deleteClerkTestUser } from './helpers/db-verify';

let clerkUserId: string | null = null; // We might not easily get this from UI flow without API interception

test.describe.serial('PAT-001C — Customer Journey (Real Clerk UI)', () => {
  const testData = generateE2ECompany('PAT-C'); // Use a specific sequence prefix for PAT-001C

  test.beforeAll(async () => {
    console.log(`[PAT-001C] Starting run with sequence: ${testData.sequence}`);
    await resetE2EDatabase();
  });

  // We can't easily delete the user here unless we fetch the ID from Clerk's backend using the email,
  // or we intercept the response during signup.
  // For simplicity, resetE2EDatabase in a future run will clean up the DB,
  // but we should ideally clean up Clerk too.
  test.afterAll(async () => {
    if (clerkUserId) {
      await deleteClerkTestUser(clerkUserId);
      console.log(`[PAT-001C] Cleaned up Clerk user: ${clerkUserId}`);
    } else {
        // Attempt to find and delete by email if ID is unknown (requires custom helper implementation)
        console.log(`[PAT-001C] Clerk user ID unknown, relying on manual or periodic cleanup for ${testData.administrator.email}`);
    }
  });

  test('Real Clerk UI Signup Flow', async ({ page }) => {
    // Intercept clerk API calls to grab the user ID if possible,
    // though the Clerk SDK might obfuscate it.
    page.on('response', async (response) => {
        if (response.url().includes('client/sign_ups') && response.status() === 200) {
            try {
                const data = await response.json();
                if (data.client?.sessions?.[0]?.user?.id) {
                    clerkUserId = data.client.sessions[0].user.id;
                    console.log(`[PAT-001C] Captured Clerk User ID from response: ${clerkUserId}`);
                }
            } catch (e) {
                // Ignore parse errors on intermediate requests
            }
        }
    });

    await signUpViaClerkUI(page, testData.administrator.email, testData.administrator.password);

    // Verify it redirects to onboarding
    await page.waitForURL('**/company**', { timeout: 15_000 });
    await expect(page.locator('h1')).toContainText('preparar tu entorno');
    
    // We only test the signup flow here. The rest of the journey is covered by PAT-001B.
    // If needed, we could duplicate the whole flow, but usually, auth is the only difference.
  });
});
