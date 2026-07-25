/**
 * E2E Deterministic Company Generator
 *
 * Generates unique but reproducible test company data.
 * Uses a counter persisted across phases within a single test run.
 *
 * Deterministic contract:
 *   - Same sequence number → same company name, CIF, emails
 *   - Different sequence   → different non-colliding data
 *
 * CIF uses B9XXXXXXX format which is valid for Sociedades Limitadas in tests.
 * These CIFs are structurally valid but clearly E2E (B9x prefix).
 */

export const E2E_EMAIL_DOMAIN =
  process.env.E2E_EMAIL_DOMAIN || 'e2e-test.redyredes.com';

export interface E2ECompany {
  sequence: string;
  company: {
    name: string;
    cif: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
  };
  administrator: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string; // Used for Clerk signup in PAT-001C
  };
  services: {
    selectedModules: string[];
  };
  legal: {
    contractVersion: string;
    privacyVersion: string;
    slaVersion: string;
  };
  correlationId: string;
}

/**
 * Generates a deterministic E2E company.
 * sequence: a 4-digit string like '0042'. If omitted, uses timestamp.
 */
export function generateE2ECompany(sequenceOverride?: string): E2ECompany {
  const seq = sequenceOverride ?? String(Date.now()).slice(-6).padStart(6, '0');
  const padded = seq.padStart(4, '0');

  return {
    sequence: seq,
    company: {
      name: `ARK TEST ${padded}`,
      // B9XXXXXXX — structurally valid CIF for test
      cif: `B9${padded.padStart(7, '0')}`,
      address: `Calle de Pruebas ${padded}, Planta 1`,
      postalCode: '28001',
      city: 'Madrid',
      province: 'Madrid',
      country: 'España',
    },
    administrator: {
      firstName: 'Admin',
      lastName: `Test${padded}`,
      email: `admin${padded}@${E2E_EMAIL_DOMAIN}`,
      // Deterministic but complex enough for Clerk's password policy
      password: `E2eTest${padded}!RedyRedes`,
      phone: `+3460000${padded}`,
    },
    services: {
      selectedModules: ['HARDWARE_SUPPORT', 'NETWORK_MANAGEMENT'],
    },
    legal: {
      contractVersion: '1.0',
      privacyVersion: '1.0',
      slaVersion: '1.0',
    },
    correlationId: `e2e-pat001b-${padded}-${Date.now()}`,
  };
}
