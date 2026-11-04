const MAX_TRANSACTION_ATTEMPTS = 3;
const RETRYABLE_DATABASE_CODES = new Set(["40001", "40P01"]);

/**
 * Prisma's P2028 also covers a transaction that expired after running statements; only one
 * that never started (no connection within maxWait) is safe to run again.
 */
const UNSTARTED_TRANSACTION = /Unable to start a transaction in the given time/;

/**
 * Two writers collided and the database refused one: a deadlock, a serialization failure, or a
 * write conflict. Prisma reports the last of these when a transaction commits as a driver error
 * with no `code`, only a `cause`.
 */
export function isWriteConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const cause = (error as { cause?: { kind?: unknown; originalCode?: unknown } }).cause;
  if (cause?.kind === "TransactionWriteConflict") return true;
  if (typeof cause?.originalCode === "string" && RETRYABLE_DATABASE_CODES.has(cause.originalCode))
    return true;
  if (!("code" in error)) return false;
  const prismaError = error as {
    code?: unknown;
    meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } };
  };
  if (prismaError.code === "P2034") return true;
  const databaseCode = prismaError.meta?.driverAdapterError?.cause?.originalCode;
  return typeof databaseCode === "string" && RETRYABLE_DATABASE_CODES.has(databaseCode);
}

function isRetryableTransactionConflict(error: unknown): boolean {
  if (error instanceof Error && UNSTARTED_TRANSACTION.test(error.message)) return true;
  return isWriteConflict(error);
}

export async function withTransactionRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableTransactionConflict(error) || attempt >= MAX_TRANSACTION_ATTEMPTS) {
        throw error;
      }
    }
  }
}
