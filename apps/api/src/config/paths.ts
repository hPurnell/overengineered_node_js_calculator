import { resolve } from 'node:path';

/**
 * Absolute path to the monorepo root.
 *
 * Relative configuration — `.env`, `file:./data/calculator.db` — is resolved
 * against this rather than `process.cwd()`, because cwd differs by entry point:
 * `node apps/api/dist/main.js` runs from the repo root, while
 * `npm run db:migrate --workspace @calc/api` runs from `apps/api`. Anchoring to
 * cwd would quietly point the migration CLI at a different database than the
 * server uses.
 *
 * The depth is the same from `src/config` under tsx and `dist/config` under
 * node, so one constant serves both.
 */
export const WORKSPACE_ROOT = resolve(__dirname, '..', '..', '..', '..');
