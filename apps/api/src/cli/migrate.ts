#!/usr/bin/env node
/**
 * Standalone migration runner.
 *
 * Deployments that disable `autoMigrate` run this as a release step:
 *
 *   HISTORY_STORE_URL=file:./data/calculator.db npm run db:migrate --workspace @calc/api
 */
import { loadEnvFile } from '../config/env-file';
import { loadConfig } from '../config/environment';
import { WORKSPACE_ROOT } from '../config/paths';
import { migrateHistoryStore } from '../persistence';

function main(): void {
  loadEnvFile();

  // Resolved through the same validated config the server uses. Reading
  // process.env here would re-declare the default, and a typo'd variable would
  // migrate the default database while the server failed to boot against
  // another one.
  const { historyStore } = loadConfig();

  const result = migrateHistoryStore({
    url: historyStore.url,
    baseDirectory: WORKSPACE_ROOT,
    ...(historyStore.migrationsFolder === undefined
      ? {}
      : { migrationsFolder: historyStore.migrationsFolder }),
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
