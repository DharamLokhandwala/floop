export const DEFAULT_JSON_CAS_ATTEMPTS = 5;

export class AuditPinConflictError extends Error {
  readonly code = "AUDIT_PIN_CONFLICT";

  constructor(message = "Comments changed concurrently; please retry") {
    super(message);
    this.name = "AuditPinConflictError";
  }
}

export function isAuditPinConflictError(
  error: unknown
): error is AuditPinConflictError {
  return (
    error instanceof AuditPinConflictError ||
    (error instanceof Error &&
      "code" in error &&
      error.code === "AUDIT_PIN_CONFLICT")
  );
}

export type JsonArraySnapshot = { raw: string | null };

export type JsonArrayMutation<T, Result> =
  | { kind: "write"; next: T[]; result: Result }
  | { kind: "noop"; result: Result };

type MutationContext = {
  /** Zero-based attempt number. A value above zero means a CAS already lost. */
  attempt: number;
};

type BeforeCompareAndSwapContext<T, Result> = {
  current: T[];
  next: T[];
  result: Result;
  attempt: number;
};

export type MutateJsonArrayOptions<T, Result> = {
  operation: string;
  read: () => Promise<JsonArraySnapshot | null>;
  compareAndSwap: (
    expectedRaw: string | null,
    nextRaw: string
  ) => Promise<boolean>;
  mutate: (
    current: T[],
    context: MutationContext
  ) => JsonArrayMutation<T, Result>;
  initialSnapshot?: JsonArraySnapshot;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  onConflict?: (attempt: number, maxAttempts: number) => void;
  beforeCompareAndSwap?: (
    context: BeforeCompareAndSwapContext<T, Result>
  ) => Promise<void>;
};

function parseJsonArray<T>(raw: string | null): T[] {
  const parsed = JSON.parse(raw ?? "[]") as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Stored pin data is not a JSON array");
  }
  return parsed as T[];
}

/**
 * Applies a read/modify/write operation using a conditional update. A lost CAS
 * is retried against fresh data; exhausting retries is an explicit conflict.
 */
export async function mutateJsonArrayWithRetry<T, Result>(
  options: MutateJsonArrayOptions<T, Result>
): Promise<Result> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_JSON_CAS_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? 8;
  const maxDelayMs = options.maxDelayMs ?? 150;
  const random = options.random ?? Math.random;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const snapshot =
      attempt === 0 && options.initialSnapshot
        ? options.initialSnapshot
        : await options.read();
    if (!snapshot) throw new Error("Audit not found");

    const current = parseJsonArray<T>(snapshot.raw);
    const mutation = options.mutate(current, { attempt });
    if (mutation.kind === "noop") return mutation.result;

    await options.beforeCompareAndSwap?.({
      current,
      next: mutation.next,
      result: mutation.result,
      attempt,
    });

    const updated = await options.compareAndSwap(
      snapshot.raw,
      JSON.stringify(mutation.next)
    );
    if (updated) return mutation.result;

    options.onConflict?.(attempt + 1, maxAttempts);
    if (attempt + 1 < maxAttempts) {
      const exponentialDelay = baseDelayMs * 2 ** attempt;
      const jitter = Math.floor(random() * Math.max(1, baseDelayMs));
      await sleep(Math.min(maxDelayMs, exponentialDelay + jitter));
    }
  }

  throw new AuditPinConflictError(
    `${options.operation} conflicted ${maxAttempts} times; please retry`
  );
}
