/** Base class for failures originating inside the history store. */
export class HistoryStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** The store could not be opened, or the connection was lost. */
export class HistoryStoreUnavailableError extends HistoryStoreError {}

/** A caller supplied a cursor the adapter cannot decode. */
export class InvalidCursorError extends HistoryStoreError {
  constructor(message = 'Cursor is malformed or no longer valid') {
    super(message);
  }
}

/** Migrations could not be applied. */
export class MigrationFailedError extends HistoryStoreError {}
