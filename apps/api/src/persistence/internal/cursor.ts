import { InvalidCursorError } from '../errors';

/**
 * The position a keyset cursor points at.
 *
 * History is ordered by `(createdAt DESC, id DESC)`, so both components are
 * needed: timestamps collide when several calculations land in the same
 * millisecond, and the id breaks the tie deterministically.
 */
export interface CursorPosition {
  readonly createdAtMs: number;
  readonly id: string;
}

const SEPARATOR = '|';

/**
 * Encodes a cursor as base64url.
 *
 * The encoding exists to signal "opaque, do not construct by hand", not to
 * provide security: it is trivially reversible and must never carry anything
 * the caller is not already allowed to see.
 */
export function encodeCursor(position: CursorPosition): string {
  const payload = `${position.createdAtMs}${SEPARATOR}${position.id}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/** Decodes a cursor produced by {@link encodeCursor}. */
export function decodeCursor(cursor: string): CursorPosition {
  let payload: string;
  try {
    payload = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch (cause) {
    throw new InvalidCursorError(`Cursor is not valid base64url: ${String(cause)}`);
  }

  const separatorIndex = payload.indexOf(SEPARATOR);
  if (separatorIndex === -1) {
    throw new InvalidCursorError();
  }

  const createdAtMs = Number(payload.slice(0, separatorIndex));
  const id = payload.slice(separatorIndex + 1);

  if (!Number.isSafeInteger(createdAtMs) || createdAtMs < 0 || id.length === 0) {
    throw new InvalidCursorError();
  }

  return { createdAtMs, id };
}
