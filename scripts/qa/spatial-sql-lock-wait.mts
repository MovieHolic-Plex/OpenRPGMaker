import assert from "node:assert/strict";
import { closeSync, fstatSync, openSync, readSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { StringDecoder } from "node:string_decoder";

type WaitEvent = {
  readonly backendPid: string;
  readonly mode: string;
  readonly identity: string;
  readonly line: string;
};

// Mutable append-only log cursor. fs.watch is an OS event subscription, not polling.
// The runner owns this non-rotating log, its prefix, and PostgreSQL's C locale.
export class LockWait implements Disposable {
  readonly event: Promise<WaitEvent>;
  private readonly descriptor: number;
  private readonly watcher: FSWatcher;
  private readonly cancel: () => void;

  constructor(path: string, backendPid: string, private readonly signal = AbortSignal.timeout(15_000)) {
    assert(/^\d+$/.test(backendPid), "Expected a PostgreSQL backend PID");
    this.descriptor = openSync(path, "r");
    let offset = fstatSync(this.descriptor).size;
    let pending = "";
    const decoder = new StringDecoder("utf8");
    const completion = Promise.withResolvers<WaitEvent>();
    this.event = completion.promise;
    this.cancel = () => { completion.reject(signal.reason); };
    this.watcher = watch(path, () => {
      try {
        const size = fstatSync(this.descriptor).size;
        assert(size >= offset, "Owned PostgreSQL log must not truncate during a race");
        const buffer = Buffer.alloc(size - offset);
        const bytes = readSync(this.descriptor, buffer, 0, buffer.length, offset);
        offset += bytes;
        pending += decoder.write(buffer.subarray(0, bytes));
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          const match = /^\[(\d+)\] LOG:  process (\d+) still waiting for (\w+) on (.+) after [\d.]+ ms$/.exec(line);
          if (match?.[1] !== backendPid || match[2] !== backendPid) continue;
          const [, , , mode, identity] = match;
          assert(mode && identity, "Expected the PostgreSQL lock wait identity");
          completion.resolve({ backendPid, mode, identity, line });
        }
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        // An I/O or protocol failure rejects the barrier; it can never release the holder.
        completion.reject(error);
      }
    });
    this.watcher.on("error", completion.reject);
    signal.addEventListener("abort", this.cancel, { once: true });
    if (signal.aborted) this.cancel();
  }

  [Symbol.dispose](): void {
    this.signal.removeEventListener("abort", this.cancel);
    this.watcher.close();
    closeSync(this.descriptor);
  }
}
