#!/usr/bin/env node
/**
 * Standalone migration runner.
 *
 * Deployments that disable `autoMigrate` run this as a release step:
 *
 *   HISTORY_STORE_URL=file:./data/calculator.db npm run db:migrate --workspace @calc/api
 */
import { loadEnvFile } from '../config/env-file';
import { WORKSPACE_ROOT } from '../config/paths';
import { migrateHistoryStore } from '../persistence';

function main(): void {
  loadEnvFile();

  const url = process.env['HISTORY_STORE_URL'] ?? 'file:./data/calculator.db';
  const override = process.env['HISTORY_STORE_MIGRATIONS'];

  const result = migrateHistoryStore({
    url,
    baseDirectory: WORKSPACE_ROOT,
    ...(override === undefined ? {} : { migrationsFolder: override }),
  });

  process.stdout.write(`Applied migrations from ${result.migrationsFolder}\n`);
  process.stdout.write(`History store at ${result.location} is up to date.\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `Migration failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  if (error instanceof Error && error.cause !== undefined) {
    process.stderr.write(`Caused by: ${String(error.cause)}\n`);
  }
  process.exitCode = 1;
}
