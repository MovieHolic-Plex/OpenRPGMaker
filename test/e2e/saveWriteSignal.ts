type SaveWriteOutcome = "written" | "timeout" | "cancelled";

declare global {
  interface Window {
    __saveWriteSignal?: {
      readonly completion: Promise<SaveWriteOutcome>;
      readonly dispose: () => void;
    };
  }
}

/** Self-contained so Playwright can evaluate it in the browser before triggering save. */
export function armSaveWriteSignal(key: string): void {
  const storage = window.localStorage;
  const original = storage.setItem;
  let cancel: () => void = () => undefined;
  const completion = new Promise<SaveWriteOutcome>((resolve) => {
    const finish = (outcome: SaveWriteOutcome): void => {
      clearTimeout(timeout);
      Object.defineProperty(storage, "setItem", { configurable: true, writable: true, value: original });
      resolve(outcome);
    };
    const timeout = setTimeout(() => finish("timeout"), 5_000);
    cancel = () => finish("cancelled");
    Object.defineProperty(storage, "setItem", {
      configurable: true,
      writable: true,
      value: function (this: Storage, writtenKey: string, value: string): void {
        original.call(this, writtenKey, value);
        if (this === storage && writtenKey === key) finish("written");
      },
    });
  });
  window.__saveWriteSignal = {
    completion,
    dispose: () => {
      cancel();
      delete window.__saveWriteSignal;
    },
  };
}
