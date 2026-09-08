import { clearTimeout, setTimeout } from "node:timers";
import { onTestFinished } from "vitest";
import type { AutoSaveState } from "@/project/store";

export function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((done) => { resolve = done; });
  if (!resolve) throw new Error("Deferred resolver was not initialized");
  return { promise, resolve };
}

/** Real deadline even while a test advances the autosave's virtual clock. */
export function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Persistence signal did not arrive")), 10_000);
  });
  onTestFinished(() => clearTimeout(timer));
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

export function nextAutoSaveState(
  store: Pick<typeof import("@/project/store").store, "subscribeAutoSave">,
  matches: (state: AutoSaveState) => boolean,
): Promise<AutoSaveState> {
  const signal = deferred<AutoSaveState>();
  const unsubscribe = store.subscribeAutoSave((state) => {
    if (!matches(state)) return;
    unsubscribe();
    signal.resolve(state);
  });
  onTestFinished(unsubscribe);
  return bounded(signal.promise);
}
