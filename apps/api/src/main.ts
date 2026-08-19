import { createHistoryStore, type HistoryStore } from './persistence';
import type { FastifyInstance } from 'fastify';

import { buildApp } from './app';
import { loadEnvFile } from './config/env-file';
import { loadConfig } from './config/environment';
import { WORKSPACE_ROOT } from './config/paths';

/**
 * Composition root.
 *
 * The only place that reads the environment, constructs the history store, and
 * owns process lifecycle. Everything below it receives its dependencies.
 */
async function main(): Promise<void> {
  // Must happen before the environment is read and validated.
  loadEnvFile();

  const config = loadConfig();

  const historyStore = createHistoryStore({
    url: config.historyStore.url,
    autoMigrate: config.historyStore.autoMigrate,
    baseDirectory: WORKSPACE_ROOT,
  });

  const app = await buildApp({ config, historyStore });

  registerShutdownHandlers(app, historyStore);

  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    { corsOrigins: config.corsOrigins },
    `Computation API listening on http://${config.host}:${config.port}`,
  );
}

/**
 * Drains in-flight requests before closing the store.
 *
 * Ordering matters: Fastify must stop accepting and finish serving first, or a
 * request in flight would find the store already shut.
 */
function registerShutdownHandlers(app: FastifyInstance, historyStore: HistoryStore): void {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    app.log.info({ signal }, 'Shutting down');

    try {
      await app.close();
      await historyStore.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', (signal) => void shutdown(signal));
  process.on('SIGTERM', (signal) => void shutdown(signal));
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Failed to start the computation API: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exit(1);
});
