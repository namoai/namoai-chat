'use server';
import 'server-only';

let loaded = false;

/**
 * Runtime stub for env loading.
 * Amplify/Lambda inject env vars; avoid bundling node built-ins during build/edge.
 */
export async function ensureEnvVarsLoaded(): Promise<void> {
  if (loaded) return;
  // If not Node runtime (edge/browser) or during build, skip.
  if (typeof process === 'undefined' || !process.versions?.node) {
    loaded = true;
    return;
  }
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    loaded = true;
    return;
  }

  // If critical vars missing, just log — do not attempt file IO to keep bundle clean.
  if (!process.env.DATABASE_URL || !process.env.NEXTAUTH_SECRET) {
    console.warn('[load-env-vars] DATABASE_URL or NEXTAUTH_SECRET not set at runtime.');
  }

  loaded = true;
}

