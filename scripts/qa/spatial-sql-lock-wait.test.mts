import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LockWait } from "./spatial-sql-lock-wait.mjs";

test("accepts only a new wait event for the contender when other backend events exist", async () => {
  // Given: historical and unrelated events must not establish the barrier.
  const directory = mkdtempSync(join(tmpdir(), "spatial-lock-log-"));
  try {
    const path = join(directory, "postgres.log");
    writeFileSync(path, "[42] LOG:  process 42 still waiting for ShareLock on transaction 10 after 50.000 ms\n");
    using wait = new LockWait(path, "42");
    // When: the server appends unrelated messages followed by this backend's wait.
    appendFileSync(path, "[43] LOG:  process 43 still waiting for ShareLock on transaction 11 after 50.000 ms\n"
      + "[42] STATEMENT:  SELECT 'still waiting for ShareLock';\n"
      + "[42] LOG:  process 42 acquired ShareLock on transaction 11 after 60.000 ms\n"
      + "[42] LOG:  process 42 still waiting for ShareLock on transaction 12 after 50.123 ms\n");
    // Then: evidence identifies the new contested lock, not earlier progress.
    assert.deepEqual(await wait.event, {
      backendPid: "42", mode: "ShareLock", identity: "transaction 12",
      line: "[42] LOG:  process 42 still waiting for ShareLock on transaction 12 after 50.123 ms",
    });
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("fails closed when the bounded signal aborts before a database wait event", async () => {
  // Given: no database event has been delivered.
  const directory = mkdtempSync(join(tmpdir(), "spatial-lock-log-"));
  try {
    const path = join(directory, "postgres.log");
    writeFileSync(path, "");
    const controller = new AbortController();
    using wait = new LockWait(path, "42", controller.signal);
    const rejected = assert.rejects(wait.event, { name: "AbortError" });
    // When: the deadline/cancellation signal fires (no real-time delay in this test).
    controller.abort();
    // Then: absence of overlap cannot become success.
    await rejected;
  } finally {
    rmSync(directory, { recursive: true });
  }
});
