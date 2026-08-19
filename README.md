# Calculator

A visual clone of the macOS Calculator, backed by a **separate computation
service** and a persisted calculation history.

Arithmetic is never evaluated in the browser. Pressing `=` (or <kbd>Enter</kbd>)
sends the expression to a standalone HTTP API, which parses and evaluates it,
records it, and returns the result. Every other key is handled locally, so the
keypad stays instant.

<!-- Screenshots omitted: run the app to see it. -->

## Architecture

```
apps/web            Next.js UI. Owns keypad state; no arithmetic.
  │  POST /api/v1/calculations   ← only on "="
  ▼
apps/api            Fastify computation API. Validation, HTTP, error mapping.
  ├── src/persistence       HistoryStore port. SQLite/Drizzle adapter behind it.
  └── @calc/calc-engine     Tokenizer → parser → evaluator → display formatter.

packages/contracts  Zod schemas + types shared by client and server.
```

Four boundaries do the load-bearing work:

| Boundary | What it hides |
| --- | --- |
| `@calc/contracts` | The wire format. One schema set, validated on both ends. |
| `@calc/calc-engine` | Arithmetic. Pure, synchronous, no I/O, no HTTP awareness. |
| `apps/api/src/persistence` | **That history is SQLite.** Callers see only the `HistoryStore` interface. |
| `apps/api` | HTTP. The engine and the store know nothing about status codes. |

### The storage abstraction

`src/persistence` exposes a domain model, a port, the factories, and its errors
— and nothing else:

```ts
import { createHistoryStore, type HistoryStore } from './persistence';

const store: HistoryStore = createHistoryStore({ url: 'file:./data/calculator.db' });
await store.append({ expression: '2+2', displayExpression: '2 + 2', result: '4', displayResult: '4' });
```

No Drizzle type, SQLite type, or table definition escapes the directory. The
adapter (`SqliteHistoryStore`) lives under `internal/` and is never exported —
callers reach it only through the factory, which returns the interface.
Replacing SQLite with a networked database is a change confined to
`src/persistence`.

Because the layer is a directory rather than a package, nothing at the module
system level stops a relative import into `internal/`. That guarantee is
restored by [`boundary.test.ts`](apps/api/src/persistence/boundary.test.ts),
which fails the build if any file outside the layer imports `better-sqlite3` or
`drizzle-orm`, reaches into `internal/`, or bypasses the layer's index.

Every port method is `async` even though better-sqlite3 is synchronous. That is
the seam that makes such a swap a drop-in.

### Schema and migrations

The table is declared once, in Drizzle's schema DSL
([`schema.ts`](apps/api/src/persistence/internal/schema.ts)), and that
declaration is the source of truth `drizzle-kit` diffs to generate migrations:

```ts
export const calculations = sqliteTable('calculations', {
  id:                text('id').primaryKey(),
  expression:        text('expression').notNull(),
  displayExpression: text('display_expression').notNull(),
  result:            text('result').notNull(),          // TEXT, not REAL — see below
  displayResult:     text('display_result').notNull(),
  createdAt:         integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [ index('calculations_created_at_id_idx').on(table.createdAt, table.id) ]);
```

Rows are mapped to a `CalculationRecord` domain model before they cross the
port. Migrations live in [`migrations/`](apps/api/migrations) and
are applied automatically on boot (`HISTORY_STORE_AUTO_MIGRATE=true`), or as a
separate release step:

```bash
npm run db:generate   # after editing schema.ts
npm run db:migrate    # apply pending migrations
```

## Running it

Requires **Node ≥ 20.12**.

```bash
npm install
npm rebuild better-sqlite3   # see "Native modules" below
cp .env.example .env
npm run dev
```

- Web UI → <http://localhost:3000>
- API → <http://localhost:4000>

`npm run dev` builds the packages, then runs the API and the web app together.

### Debugging

VS Code profiles are committed in [`.vscode/launch.json`](.vscode/launch.json).
**Full stack (API + Web)** starts both with breakpoints active; **Test: current
file** runs whichever spec is focused, in any workspace. The API profile runs
the TypeScript sources through `tsx`, so there is no build step between editing
and hitting a breakpoint.

### Native modules

npm 11 blocks package install scripts by default. `better-sqlite3` needs its
native binding compiled, so if you see `Could not locate the bindings file`,
run `npm rebuild better-sqlite3` (or `npm approve-scripts`).

## Verifying

```bash
npm test         # 90 tests across all three workspaces
npm run typecheck
npm run build
```

| Workspace | Covers |
| --- | --- |
| `@calc/calc-engine` | Precedence, associativity, decimal exactness, percent semantics, safety limits, display formatting |
| `@calc/api` | Routing, validation, status codes, CORS, health, error envelope; plus migrations, keyset pagination, precision round-trip, and the persistence-boundary rules |
| `@calc/web` | The full keypad state machine and expression building |

## Notable decisions

**Results are decimals, not floats.** The engine uses `decimal.js`, so
`0.1 + 0.2` is exactly `0.3`. Results are stored and transmitted as **strings**
in a `TEXT` column — SQLite's `REAL` is an IEEE-754 double and would silently
destroy the precision the engine works to preserve.

**Percent is context-sensitive, as on Apple's calculators.** `200 + 10%` is
`220`, not `200.1`; but `200 × 10%` is `20`. Only the evaluator can see the
parent operator, so `%` is its own AST node resolved at evaluation time rather
than folded into a division during parsing.

**Two representations of every expression.** The UI shows Apple's glyphs
(`×`, `÷`, `−`) but always transmits canonical ASCII, so the grammar the server
parses stays small and unambiguous. Both forms are stored: `displayExpression`
is echoed in history and never parsed.

**The expression strip is a deliberate addition.** Because evaluation is
deferred to the server until `=`, the secondary line above the readout is the
only feedback that a queued operator or a `%` was registered.

**History pages with a keyset cursor**, not `OFFSET`: paging cost stays flat as
history grows, and a calculation inserted mid-page cannot shift entries onto a
page the client has already seen.

**Validation errors are matched structurally, not with `instanceof`.** Zod ships
both CJS and ESM builds; a bundler can hand the contracts package one copy and
the app the other, giving two distinct `ZodError` classes. An `instanceof` check
across that boundary silently turns a 400 into a 500 — so `isValidationError`
tests shape, with `instanceof` only as a fast path.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/calculations` | Evaluate an expression and record it. `201` |
| `GET` | `/api/v1/calculations?limit&cursor` | History, newest first. `200` |
| `DELETE` | `/api/v1/calculations` | Clear all history. `200` |
| `DELETE` | `/api/v1/calculations/:id` | Delete one entry. `204` |
| `GET` | `/health` | Liveness + dependency status. `200`/`503` |

A malformed expression is a `400`; one that is valid but unevaluable (division
by zero) is a `422`. Every error uses one envelope:

```json
{ "error": { "code": "DIVISION_BY_ZERO", "message": "Division by zero",
             "requestId": "req-5", "details": { "expression": "1/0", "position": 1 } } }
```

## Keyboard

`0`–`9` · `.` · `+` `-` `*` `/` · <kbd>Enter</kbd>/`=` evaluate ·
<kbd>Esc</kbd>/`C` clear · <kbd>Backspace</kbd> delete · `%` percent · `N` sign
