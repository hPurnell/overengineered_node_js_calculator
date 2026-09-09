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
    // The same variable the server and the migration CLI read, so tooling
    // cannot end up pointed at a different file. drizzle-kit wants a path, so
    // the `file:` scheme the datasource URL carries is stripped here.
    url: (process.env.HISTORY_STORE_URL ?? 'file:./data/calculator.db').replace(/^file:/, ''),
  },
  strict: true,
  verbose: true,
});
