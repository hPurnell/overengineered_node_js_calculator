import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration.
 *
 * Used only by developer tooling (`db:generate`, `db:studio`). The runtime
 * never reads this file — it opens the database through `createHistoryStore`,
 * and nothing outside `src/persistence` is aware Drizzle exists at all.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/persistence/internal/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.HISTORY_STORE_FILE ?? './data/calculator.db',
  },
  strict: true,
  verbose: true,
});
