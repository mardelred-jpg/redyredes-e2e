import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

export function verifyEnv() {
  const envPath = path.resolve(process.cwd(), '.env.e2e');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  const requiredVars = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'E2E_API_URL',
    'E2E_JOIN_URL',
    'E2E_DASHBOARD_URL'
  ];

  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      console.error(`Abort: Missing environment variable: ${envVar}`);
      process.exit(1);
    }
  }
}
