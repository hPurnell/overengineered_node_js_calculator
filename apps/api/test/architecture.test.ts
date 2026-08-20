import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Architecture tests for the API's internal layers.
 *
 * Both `persistence` and `engine` began life as separate packages, where an
 * `exports` field made their internals physically unreachable — a deep import
 * failed at runtime. Inside the app that guarantee is gone: any file can reach
 * `engine/internal` with a relative path, or import `mathjs` directly and
 * bypass the grammar allowlist entirely.
 *
 * These tests restore the guarantee by asserting it, so the rules fail the
 * build rather than eroding one convenient import at a time.
 */

// The suite lives in test/, so the tree it inspects is a sibling directory.
// Only production code is scanned: tests legitimately reach past a public
// surface at times, and a test importing mathjs is harmless.
const SRC_ROOT = resolve(__dirname, '..', 'src');

interface LayerRule {
  readonly name: string;
  /** Third-party packages confined to the layer's `internal/` directory. */
  readonly internalOnly: readonly string[];
  /** Third-party packages confined to the layer, but allowed at its root. */
  readonly layerOnly: readonly string[];
}

const LAYERS: readonly LayerRule[] = [
  {
    name: 'persistence',
    // Nothing above the adapter may know history is kept in SQLite.
    internalOnly: ['better-sqlite3', 'drizzle-orm', 'drizzle-kit'],
    layerOnly: [],
  },
  {
    name: 'engine',
    // mathjs must only ever be reached through the hardened instance: an
    // unguarded `evaluate` accepts function calls, and `zeros(20000,20000)`
    // exhausts the heap and takes the process down.
    internalOnly: ['mathjs'],
    // decimal.js is the display layer's numeric type, declared at the layer
    // root, but still must not leak to callers.
    layerOnly: ['decimal.js'],
  },
];

interface SourceFile {
  readonly path: string;
  readonly imports: readonly string[];
  readonly reExports: readonly string[];
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

const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"]([^'"]+)['"]/g;
const RE_EXPORT_PATTERN = /(?:^|\n)\s*export\b[^'"\n]*?from\s*['"]([^'"]+)['"]/g;

const sourceFiles: SourceFile[] = listSourceFiles(SRC_ROOT).map((path) => {
  const source = readFileSync(path, 'utf8');
  return {
    path,
    imports: [...source.matchAll(IMPORT_PATTERN)].map((m) => m[1] as string),
    reExports: [...source.matchAll(RE_EXPORT_PATTERN)].map((m) => m[1] as string),
  };
});

const isInside = (path: string, root: string): boolean =>
  path === root || path.startsWith(root + sep);

const show = (path: string): string => relative(SRC_ROOT, path);

const matchesPackage = (specifier: string, pkg: string): boolean =>
  specifier === pkg || specifier.startsWith(`${pkg}/`);

describe.each(LAYERS)('$name layer', (layer) => {
  const layerRoot = join(SRC_ROOT, layer.name);
  const internalRoot = join(layerRoot, 'internal');

  const outsideLayer = sourceFiles.filter((file) => !isInside(file.path, layerRoot));
  const outsideInternal = sourceFiles.filter((file) => !isInside(file.path, internalRoot));
  const layerPublicFiles = sourceFiles.filter(
    (file) => isInside(file.path, layerRoot) && !isInside(file.path, internalRoot),
  );

  it('exists and contains source', () => {
    // Guards against a rename silently turning every rule below into a no-op.
    expect(layerPublicFiles.length).toBeGreaterThan(0);
    expect(sourceFiles.filter((f) => isInside(f.path, internalRoot)).length).toBeGreaterThan(0);
  });

  it.runIf(layer.internalOnly.length > 0)(
    'keeps its implementation packages inside internal/',
    () => {
      const offenders = outsideInternal.flatMap((file) =>
        file.imports
          .filter((s) => layer.internalOnly.some((pkg) => matchesPackage(s, pkg)))
          .map((s) => `${show(file.path)} imports ${s}`),
      );

      expect(offenders).toEqual([]);
    },
  );

  it.runIf(layer.layerOnly.length > 0)('keeps its own packages inside the layer', () => {
    const offenders = outsideLayer.flatMap((file) =>
      file.imports
        .filter((s) => layer.layerOnly.some((pkg) => matchesPackage(s, pkg)))
        .map((s) => `${show(file.path)} imports ${s}`),
    );

    expect(offenders).toEqual([]);
  });

  it('never re-exports its internals through the public surface', () => {
    const offenders = layerPublicFiles.flatMap((file) =>
      file.reExports
        .filter((s) => s.includes('internal/'))
        .map((s) => `${show(file.path)} re-exports ${s}`),
    );

    // Importing an internal for construction is fine; re-exporting one hands
    // callers the very type the layer exists to hide.
    expect(offenders).toEqual([]);
  });

  it('is never reached into from outside', () => {
    const offenders = outsideLayer.flatMap((file) =>
      file.imports
        .filter((s) => s.startsWith('.'))
        .filter((s) => isInside(resolve(file.path, '..', s), internalRoot))
        .map((s) => `${show(file.path)} imports ${s}`),
    );

    expect(offenders).toEqual([]);
  });

  it('is imported through its index, not a deep path', () => {
    const offenders = outsideLayer.flatMap((file) =>
      file.imports
        .filter((s) => s.startsWith('.'))
        .filter((s) => {
          const target = resolve(file.path, '..', s);
          return isInside(target, layerRoot) && target !== layerRoot;
        })
        .map((s) => `${show(file.path)} imports ${s}`),
    );

    // `./engine` is the whole public surface; `./engine/internal/guard` would
    // couple callers to the layer's internal file layout.
    expect(offenders).toEqual([]);
  });
});

describe('the scan itself', () => {
  it('covers a meaningful number of files', () => {
    // Without this, a broken walker would make every rule above pass vacuously.
    expect(sourceFiles.length).toBeGreaterThan(20);
    expect(sourceFiles.some((f) => f.imports.length > 0)).toBe(true);
  });
});
