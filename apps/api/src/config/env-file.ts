import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { WORKSPACE_ROOT } from './paths';

/**
 * Loads a `.env` file into `process.env` for local development.
 *
 * Uses Node's built-in loader rather than a dependency. Real environment
 * variables always win: `loadEnvFile` overwrites what is already set, so
 * existing values are captured first and restored afterwards. That keeps a
 * developer's `.env` from silently overriding what a container or CI job
 * injected.
 *
 * A missing file is not an error — in production there is no `.env` at all.
 */
export function loadEnvFile(relativePath = '.env', baseDirectory = WORKSPACE_ROOT): boolean {
  const path = resolve(baseDirectory, relativePath);

  if (!existsSync(path)) {
    return false;
  }

  const explicit = { ...process.env };

  process.loadEnvFile(path);

  for (const [key, value] of Object.entries(explicit)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }

  return true;
}
