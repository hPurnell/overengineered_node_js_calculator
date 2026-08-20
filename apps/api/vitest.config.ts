import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests live in a sibling `test/` tree rather than beside the source, which
    // is the prevailing convention for Node services and libraries — and the
    // one the Fastify ecosystem this service sits in uses throughout.
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // better-sqlite3 is a native addon: keep suites in one process per file.
    pool: 'forks',
  },
});
