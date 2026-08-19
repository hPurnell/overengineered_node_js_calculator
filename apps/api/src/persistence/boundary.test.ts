import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Architecture tests for the persistence boundary.
 *
 * When the store lived in its own package, an `exports` field made the SQLite
 * adapter physically unreachable — a deep import failed at runtime. Inside the
 * app that guarantee is gone: any file can reach `persistence/internal` with a
 * relative path and nothing would stop it.
 *
 * These tests restore the guarantee by asserting it directly, so the rule fails
 * the build rather than eroding one convenient import at a time.
 */

const SRC_ROOT = resolve(__dirname, '..');
const PERSISTENCE_ROOT = resolve(__dirname);
const INTERNAL_ROOT = join(PERSISTENCE_ROOT, 'internal');

/** Storage-engine packages that must not leak past the adapter. */
const ENGINE_PACKAGES = ['better-sqlite3', 'drizzle-orm', 'drizzle-kit'];

interface SourceFile {
  readonly path: string;
  readonly imports: readonly string[];
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(full);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
  });
}

/** Extracts module specifiers from static imports, type imports and re-exports. */
function readImports(path: string): string[] {
  const source = readFileSync(path, 'utf8');
  const pattern = /(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"]([^'"]+)['"]/g;

  return [...source.matchAll(pattern)].map((match) => match[1] as string);
}

const sourceFiles: SourceFile[] = listSourceFiles(SRC_ROOT).map((path) => ({
  path,
  imports: readImports(path),
}));

const isInside = (path: string, root: string): boolean =>
  path === root || path.startsWith(root + sep);

/** Files that sit outside the persistence layer entirely. */
const consumers = sourceFiles.filter((file) => !isInside(file.path, PERSISTENCE_ROOT));

/** Files inside the layer but outside the adapter. */
const layerPublicFiles = sourceFiles.filter(
  (file) => isInside(file.path, PERSISTENCE_ROOT) && !isInside(file.path, INTERNAL_ROOT),
);

const show = (path: string): string => relative(SRC_ROOT, path);

describe('the storage engine stays behind the port', () => {
  it('is not imported anywhere outside persistence/internal', () => {
    const offenders = sourceFiles
      .filter((file) => !isInside(file.path, INTERNAL_ROOT))
      .flatMap((file) =>
        file.imports
          .filter((specifier) =>
            ENGINE_PACKAGES.some(
              (pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`),
            ),
          )
          .map((specifier) => `${show(file.path)} imports ${specifier}`),
      );

    // Nothing above the adapter may know history is kept in SQLite.
    expect(offenders).toEqual([]);
  });

  it('is not re-exported through the layer’s public surface', () => {
    const offenders = layerPublicFiles
      .flatMap((file) =>
        file.imports
          .filter((specifier) => specifier.includes('internal/schema'))
          .map((specifier) => `${show(file.path)} imports ${specifier}`),
      );

    // Re-exporting the Drizzle table would leak the schema to every caller.
    expect(offenders).toEqual([]);
  });
});

describe('consumers depend only on the port', () => {
  it('never reach into persistence/internal', () => {
    const offenders = consumers.flatMap((file) =>
      file.imports
        .filter((specifier) => specifier.startsWith('.'))
        .filter((specifier) => isInside(resolve(file.path, '..', specifier), INTERNAL_ROOT))
        .map((specifier) => `${show(file.path)} imports ${specifier}`),
    );

    expect(offenders).toEqual([]);
  });

  it('import the layer through its index, not a deep path', () => {
    const offenders = consumers.flatMap((file) =>
      file.imports
        .filter((specifier) => specifier.startsWith('.'))
        .filter((specifier) => {
          const target = resolve(file.path, '..', specifier);
          return isInside(target, PERSISTENCE_ROOT) && target !== PERSISTENCE_ROOT;
        })
        .map((specifier) => `${show(file.path)} imports ${specifier}`),
    );

    // `./persistence` is the whole public surface; `./persistence/models/...`
    // would couple callers to the layer's internal file layout.
    expect(offenders).toEqual([]);
  });

  it('scans a meaningful number of files', () => {
    // Guards against the walker silently matching nothing and passing vacuously.
    expect(consumers.length).toBeGreaterThan(5);
    expect(sourceFiles.length).toBeGreaterThan(15);
  });
});
