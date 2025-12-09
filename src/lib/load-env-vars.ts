'use server';
import 'server-only';

// Simplified stub to avoid bundling Node built-ins in Next/Amplify builds.
// Assume env vars are provided by the platform (.env / Amplify / runtime).
export async function ensureEnvVarsLoaded(): Promise<void> {
  return;
}

