/**
 * API Verification Helper
 *
 * Phase 10a of PAT-001B: validates the system via its public API endpoints
 * before touching the database directly.
 *
 * This layer validates the full HTTP stack: auth, routing, serialization.
 * DB checks (Phase 10b) then confirm the underlying data is consistent.
 */

import { expect, Page } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'https://api.redyredes.com';

export interface ApiVerificationResult {
  identity: {
    authenticated: boolean;
    organizationExists: boolean;
    organizationId: string;
    next: string;
  };
  debugMe: {
    userId: string;
    customerFound: boolean;
    organizationId: string;
    organizationName: string;
    dashboardCanResolve: boolean;
  };
  workspace: {
    organizationId: string;
    name: string;
    billingState: string;
  } | null;
}

/**
 * Runs all API verification calls authenticated as the current Playwright page session.
 * Uses page.evaluate to make fetch calls with the session cookies.
 */
export async function verifyViaAPI(page: Page): Promise<ApiVerificationResult> {
  // ── /api/identity ──────────────────────────────────────────
  const identityRes = await page.evaluate(async (apiUrl: string) => {
    const r = await fetch(`${apiUrl}/api/identity`, {
      credentials: 'include',
    });
    return { status: r.status, body: (await r.json()) as any };
  }, API_URL);

  expect(identityRes.status, 'GET /api/identity should return 200').toBe(200);
  expect(identityRes.body.authenticated, '/api/identity: user must be authenticated').toBe(true);
  expect(identityRes.body.organizationExists, '/api/identity: organization must exist').toBe(true);
  expect(identityRes.body.next, '/api/identity: next must be "dashboard"').toBe('dashboard');

  // ── /api/debug/me ──────────────────────────────────────────
  const debugRes = await page.evaluate(async (apiUrl: string) => {
    const r = await fetch(`${apiUrl}/api/debug/me`, {
      credentials: 'include',
    });
    return { status: r.status, body: (await r.json()) as any };
  }, API_URL);

  expect(debugRes.status, 'GET /api/debug/me should return 200').toBe(200);
  expect(debugRes.body.customerFound, '/api/debug/me: customer must be found').toBe(true);
  expect(
    debugRes.body.organizationId,
    '/api/debug/me: organizationId must be set'
  ).toBeTruthy();
  expect(
    debugRes.body.dashboardCanResolve,
    '/api/debug/me: dashboardCanResolve must be true'
  ).toBe(true);

  // ── /api/workspace ─────────────────────────────────────────
  const workspaceRes = await page.evaluate(async (apiUrl: string) => {
    const r = await fetch(`${apiUrl}/api/workspace/context`, {
      credentials: 'include',
    });
    if (r.status === 404) return { status: 404, body: null };
    return { status: r.status, body: (await r.json()) as any };
  }, API_URL);

  // Workspace endpoint is optional if not yet fully implemented
  const workspaceData = workspaceRes.status === 200 ? workspaceRes.body : null;
  if (workspaceData) {
    expect(workspaceData.organizationId, 'workspace: organizationId must match identity').toBe(
      identityRes.body.organizationId
    );
  }

  return {
    identity: identityRes.body,
    debugMe: debugRes.body,
    workspace: workspaceData,
  };
}

/**
 * Verifies the ticket list API returns at least one ticket.
 */
export async function verifyTicketsViaAPI(
  page: Page,
  expectedMinCount: number = 1
): Promise<void> {
  const ticketsRes = await page.evaluate(async (apiUrl: string) => {
    const r = await fetch(`${apiUrl}/api/v1/tickets`, {
      credentials: 'include',
    });
    return { status: r.status, body: (await r.json()) as any };
  }, API_URL);

  expect(ticketsRes.status, 'GET /api/v1/tickets should return 200').toBe(200);

  const tickets = ticketsRes.body.tickets || ticketsRes.body;
  expect(
    Array.isArray(tickets) && tickets.length >= expectedMinCount,
    `Tickets API must return at least ${expectedMinCount} ticket(s)`
  ).toBe(true);
}
