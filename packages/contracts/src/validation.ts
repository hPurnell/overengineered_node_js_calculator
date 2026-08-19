import { ZodError } from 'zod';

/** A single field-level validation failure, flattened for transport. */
export interface ValidationIssue {
  /** Dotted path to the offending field, e.g. `expression` or `filters.0.id`. */
  readonly path: string;
  readonly message: string;
}

/**
 * Recognises a Zod validation failure without relying on class identity.
 *
 * `instanceof ZodError` is not dependable here. Zod ships both a CommonJS and
 * an ESM build, and a bundler may hand this package the CJS copy while handing
 * the consuming app the ESM copy. Both work, but they define two distinct
 * `ZodError` classes, so an error thrown by a schema in this package fails an
 * `instanceof` check performed in the API — which is exactly how a 400 turns
 * into a 500.
 *
 * The `instanceof` test stays as a fast path; the structural test is what makes
 * the guard correct across the module boundary.
 */
export function isValidationError(error: unknown): error is ZodError {
  if (error instanceof ZodError) {
    return true;
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ZodError' &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

/** Flattens a Zod error's issues into the transport shape. */
export function toValidationIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
