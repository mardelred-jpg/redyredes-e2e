/**
 * Database Integrity Verification Helper
 *
 * Phase 10b of PAT-001B: directly queries the database to confirm
 * all entities are consistent and no PRODUCTION data has been contaminated.
 *
 * This helper requires DATABASE_URL in .env.e2e.
 * It uses a direct Prisma client — no HTTP involved.
 */

import { PrismaClient } from '@prisma/client';

const E2E_EMAIL_DOMAIN =
  process.env.E2E_EMAIL_DOMAIN || 'e2e-test.redyredes.com';

export interface DbIntegrityReport {
  organization: {
    id: string;
    name: string;
    environment: string;
    billingState: string;
  };
  customer: {
    id: string;
    email: string;
    organizationId: string;
  };
  subscription: {
    organizationId: string;
    status: string;
  };
  legalAcceptance: {
    organizationId: string;
    contractVersion: string;
  };
  productionIsolation: {
    noProductionOrgHasE2EEmail: boolean;
    noE2EOrgExistsWithProductionEnv: boolean;
  };
}

/**
 * Verifies database integrity for the given clerkUserId after a completed journey.
 * Throws if any assertion fails.
 */
import { AuthContext } from './clerk-auth';

export async function verifyDbIntegrity(
  organizationId: string,
  authContext: AuthContext
): Promise<DbIntegrityReport> {
  const prisma = new PrismaClient();

  try {
    if (!organizationId) {
      throw new Error('Abort: organizationId cannot be null or empty.');
    }

    const orgCountForId = await prisma.organization.count({ where: { id: organizationId } });
    if (orgCountForId !== 1) {
      throw new Error(`Abort: Exactly 1 Organization expected for ${organizationId}, found ${orgCountForId}`);
    }

    const customerCountForId = await prisma.customer.count({ where: { organizationId } });
    if (customerCountForId !== 1) {
      throw new Error(`Abort: Exactly 1 Customer expected for org ${organizationId}, found ${customerCountForId}`);
    }

    // ── 1. Organization exists and is E2E-tagged ────────────
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) throw new Error(`Organization ${organizationId} not found in DB`);
    if (org.environment !== 'E2E') {
      throw new Error(
        `Organization ${organizationId} has environment=${org.environment}, expected E2E`
      );
    }

    // ── 2. Customer is correctly bound ─────────────────────
    let customer;
    if (authContext.mode === 'ui') {
      customer = await prisma.customer.findFirst({
        where: { organizationId },
      });
    } else {
      customer = await prisma.customer.findFirst({
        where: {
          OR: [{ id: authContext.clerkUserId! }, { identityId: authContext.clerkUserId! }],
        },
      });
    }

    if (!customer) throw new Error(`Customer for userId=${authContext.clerkUserId} not found`);
    if (customer.organizationId !== organizationId) {
      throw new Error(
        `Customer.organizationId=${customer.organizationId} does not match expected ${organizationId}`
      );
    }

    // ── 3. Subscription exists (1:1) ───────────────────────
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) throw new Error(`Subscription for org ${organizationId} not found`);

    // ── 4. LegalAcceptance exists ──────────────────────────
    const legal = await prisma.legalAcceptance.findFirst({
      where: { organizationId },
    });
    if (!legal) throw new Error(`LegalAcceptance for org ${organizationId} not found`);

    // ── 5. No duplicates ───────────────────────────────────

    const subCount = await prisma.subscription.count({ where: { organizationId } });
    if (subCount !== 1) throw new Error(`Duplicate subscriptions found: count=${subCount}`);

    // ── 6. PRODUCTION isolation guard ─────────────────────
    // No PRODUCTION org should have customers with E2E emails
    const productionOrgsWithE2ECustomers = await prisma.customer.count({
      where: {
        email: { endsWith: `@${E2E_EMAIL_DOMAIN}` },
        organization: { environment: 'PRODUCTION' },
      },
    });

    const noProductionOrgHasE2EEmail = productionOrgsWithE2ECustomers === 0;

    // No E2E org should be miscategorized as PRODUCTION
    const e2eOrgsWithProductionEnv = await prisma.organization.count({
      where: {
        environment: 'PRODUCTION',
        customers: {
          some: { email: { endsWith: `@${E2E_EMAIL_DOMAIN}` } },
        },
      },
    });

    const noE2EOrgExistsWithProductionEnv = e2eOrgsWithProductionEnv === 0;

    if (!noProductionOrgHasE2EEmail) {
      throw new Error(
        `PRODUCTION ISOLATION BREACH: ${productionOrgsWithE2ECustomers} PRODUCTION org(s) have E2E email customers`
      );
    }

    if (!noE2EOrgExistsWithProductionEnv) {
      throw new Error(
        `PRODUCTION ISOLATION BREACH: ${e2eOrgsWithProductionEnv} org(s) with E2E emails are tagged PRODUCTION`
      );
    }

    return {
      organization: {
        id: org.id,
        name: org.name,
        environment: org.environment,
        billingState: org.billingState,
      },
      customer: {
        id: customer.id,
        email: customer.email,
        organizationId: customer.organizationId!,
      },
      subscription: {
        organizationId: subscription.organizationId,
        status: subscription.status,
      },
      legalAcceptance: {
        organizationId: legal.organizationId,
        contractVersion: legal.contractVersion,
      },
      productionIsolation: {
        noProductionOrgHasE2EEmail,
        noE2EOrgExistsWithProductionEnv,
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Resets E2E data from the database (safe — only deletes environment='E2E').
 * Also clears orphan customers with E2E emails.
 */
export async function resetE2EDatabase(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const e2eOrgs = await prisma.organization.findMany({
      where: { environment: 'E2E' },
      select: { id: true },
    });
    const e2eOrgIds = e2eOrgs.map((o: {id: string}) => o.id);

    if (e2eOrgIds.length > 0) {
      const e2eTickets = await prisma.ticket.findMany({
        where: { organizationId: { in: e2eOrgIds } },
        select: { id: true },
      });
      const e2eTicketIds = e2eTickets.map((t: {id: string}) => t.id);

      if (e2eTicketIds.length > 0) {
        await prisma.ticketHistory.deleteMany({ where: { ticketId: { in: e2eTicketIds } } });
        await prisma.ticketTimeline.deleteMany({ where: { ticketId: { in: e2eTicketIds } } });
        await prisma.ticketComment.deleteMany({ where: { ticketId: { in: e2eTicketIds } } });
        await prisma.ticket.deleteMany({ where: { organizationId: { in: e2eOrgIds } } });
      }

      await prisma.billingAuditLog.deleteMany({ where: { organizationId: { in: e2eOrgIds } } });
      await prisma.legalAcceptance.deleteMany({ where: { organizationId: { in: e2eOrgIds } } });
      await prisma.subscription.deleteMany({ where: { organizationId: { in: e2eOrgIds } } });
      await prisma.customer.deleteMany({
        where: {
          OR: [
            { organizationId: { in: e2eOrgIds } },
            { email: { endsWith: `@${E2E_EMAIL_DOMAIN}` } },
          ],
        },
      });
      await prisma.provisioningSaga.deleteMany({ where: { organizationId: { in: e2eOrgIds } } });
      await prisma.organization.deleteMany({ where: { environment: 'E2E' } });
    }

    // Orphan E2E customers
    await prisma.customer.deleteMany({
      where: { email: { endsWith: `@${E2E_EMAIL_DOMAIN}` } },
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Cleans up a specific Clerk test user via the Clerk Backend API.
 */
export async function deleteClerkTestUser(clerkUserId: string): Promise<void> {
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) return;

  await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${clerkKey}` },
  });
}
