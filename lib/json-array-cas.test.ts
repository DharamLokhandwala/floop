import assert from "node:assert/strict";
import test from "node:test";
import {
  AuditPinConflictError,
  mutateJsonArrayWithRetry,
  type JsonArrayMutation,
} from "./json-array-cas";

type TestReply = { id: string; body: string };
type TestPin = { id: string; feedback: string; replies?: TestReply[] };

function createConcurrentStore<T>(initial: T[]) {
  let raw = JSON.stringify(initial);
  let synchronizedReads = 0;
  let releaseInitialReads: (() => void) | undefined;
  const initialReadBarrier = new Promise<void>((resolve) => {
    releaseInitialReads = resolve;
  });

  return {
    async read() {
      const snapshot = raw;
      if (synchronizedReads < 2) {
        synchronizedReads += 1;
        if (synchronizedReads === 2) releaseInitialReads?.();
        await initialReadBarrier;
      }
      return { raw: snapshot };
    },
    async compareAndSwap(expectedRaw: string | null, nextRaw: string) {
      if (raw !== expectedRaw) return false;
      raw = nextRaw;
      return true;
    },
    pins() {
      return JSON.parse(raw) as T[];
    },
  };
}

function appendPin(pin: TestPin) {
  return (current: TestPin[]): JsonArrayMutation<TestPin, void> => {
    if (current.some((candidate) => candidate.id === pin.id)) {
      return { kind: "noop", result: undefined };
    }
    return { kind: "write", next: [...current, pin], result: undefined };
  };
}

function appendReply(pinId: string, reply: TestReply) {
  return (current: TestPin[]): JsonArrayMutation<TestPin, void> => {
    const index = current.findIndex((pin) => pin.id === pinId);
    assert.notEqual(index, -1);
    const replies = current[index].replies ?? [];
    if (replies.some((candidate) => candidate.id === reply.id)) {
      return { kind: "noop", result: undefined };
    }
    const next = [...current];
    next[index] = { ...next[index], replies: [...replies, reply] };
    return { kind: "write", next, result: undefined };
  };
}

function editPin(pinId: string, feedback: string) {
  return (current: TestPin[]): JsonArrayMutation<TestPin, void> => {
    const index = current.findIndex((pin) => pin.id === pinId);
    if (index < 0) {
      throw new AuditPinConflictError("Pin was deleted during the edit");
    }
    const next = [...current];
    next[index] = { ...next[index], feedback };
    return { kind: "write", next, result: undefined };
  };
}

function deletePin(pinId: string) {
  return (current: TestPin[]): JsonArrayMutation<TestPin, void> => {
    if (!current.some((pin) => pin.id === pinId)) {
      return { kind: "noop", result: undefined };
    }
    return {
      kind: "write",
      next: current.filter((pin) => pin.id !== pinId),
      result: undefined,
    };
  };
}

const noDelay = async () => {};

test("two concurrent pin additions survive a lost CAS and retry", async () => {
  const store = createConcurrentStore<TestPin>([]);
  const run = (pin: TestPin) =>
    mutateJsonArrayWithRetry({
      operation: `add ${pin.id}`,
      read: store.read,
      compareAndSwap: store.compareAndSwap,
      mutate: appendPin(pin),
      sleep: noDelay,
      random: () => 0,
    });

  await Promise.all([
    run({ id: "pin-a", feedback: "A" }),
    run({ id: "pin-b", feedback: "B" }),
  ]);

  assert.deepEqual(
    store.pins().map((pin) => pin.id).sort(),
    ["pin-a", "pin-b"]
  );
});

test("two concurrent replies are both retained", async () => {
  const store = createConcurrentStore<TestPin>([
    { id: "pin", feedback: "Pin" },
  ]);
  const run = (reply: TestReply) =>
    mutateJsonArrayWithRetry({
      operation: `reply ${reply.id}`,
      read: store.read,
      compareAndSwap: store.compareAndSwap,
      mutate: appendReply("pin", reply),
      sleep: noDelay,
      random: () => 0,
    });

  await Promise.all([
    run({ id: "reply-a", body: "A" }),
    run({ id: "reply-b", body: "B" }),
  ]);

  assert.deepEqual(
    store.pins()[0].replies?.map((reply) => reply.id).sort(),
    ["reply-a", "reply-b"]
  );
});

test("an edit racing a delete cannot resurrect the deleted pin", async () => {
  const store = createConcurrentStore<TestPin>([
    { id: "pin", feedback: "Original" },
  ]);
  const run = (
    operation: string,
    mutate: (pins: TestPin[]) => JsonArrayMutation<TestPin, void>
  ) =>
    mutateJsonArrayWithRetry({
      operation,
      read: store.read,
      compareAndSwap: store.compareAndSwap,
      mutate,
      sleep: noDelay,
      random: () => 0,
    });

  const results = await Promise.allSettled([
    run("edit pin", editPin("pin", "Edited")),
    run("delete pin", deletePin("pin")),
  ]);

  assert.deepEqual(store.pins(), []);
  for (const result of results) {
    if (result.status === "rejected") {
      assert.ok(result.reason instanceof AuditPinConflictError);
    }
  }
});

test("repeating the same pin and reply IDs does not duplicate them", async () => {
  const pinStore = createConcurrentStore<TestPin>([]);
  const pin: TestPin = { id: "pin", feedback: "Pin" };
  await Promise.all(
    [pin, pin].map((candidate) =>
      mutateJsonArrayWithRetry({
        operation: "idempotent pin",
        read: pinStore.read,
        compareAndSwap: pinStore.compareAndSwap,
        mutate: appendPin(candidate),
        sleep: noDelay,
      })
    )
  );
  assert.equal(pinStore.pins().length, 1);

  const replyStore = createConcurrentStore(pinStore.pins());
  const reply = { id: "reply", body: "Reply" };
  await Promise.all(
    [reply, reply].map((candidate) =>
      mutateJsonArrayWithRetry({
        operation: "idempotent reply",
        read: replyStore.read,
        compareAndSwap: replyStore.compareAndSwap,
        mutate: appendReply("pin", candidate),
        sleep: noDelay,
      })
    )
  );
  assert.equal(replyStore.pins()[0].replies?.length, 1);
});

test("concurrent legacy-ID backfills converge on the persisted ID", async () => {
  type LegacyPin = { id?: string; feedback: string };
  const store = createConcurrentStore<LegacyPin>([{ feedback: "Legacy" }]);
  const ensureId = (generatedId: string) =>
    mutateJsonArrayWithRetry<LegacyPin, LegacyPin[]>({
      operation: "backfill legacy ID",
      read: store.read,
      compareAndSwap: store.compareAndSwap,
      mutate: (pins) => {
        if (pins[0].id) return { kind: "noop", result: pins };
        const next = [{ ...pins[0], id: generatedId }];
        return { kind: "write", next, result: next };
      },
      sleep: noDelay,
      random: () => 0,
    });

  const results = await Promise.all([ensureId("generated-a"), ensureId("generated-b")]);
  const persistedId = store.pins()[0].id;
  assert.ok(persistedId);
  assert.equal(results[0][0].id, persistedId);
  assert.equal(results[1][0].id, persistedId);
});

test("retry exhaustion is an explicit conflict", async () => {
  let attempts = 0;
  await assert.rejects(
    mutateJsonArrayWithRetry<TestPin, void>({
      operation: "forced conflict",
      read: async () => ({ raw: "[]" }),
      compareAndSwap: async () => {
        attempts += 1;
        return false;
      },
      mutate: appendPin({ id: "pin", feedback: "Pin" }),
      maxAttempts: 3,
      sleep: noDelay,
      random: () => 0,
    }),
    AuditPinConflictError
  );
  assert.equal(attempts, 3);
});
