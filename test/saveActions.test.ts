import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveProjectNow } from "@/editor/saveActions";

type MockFlushResult =
  | { readonly kind: "conflict"; readonly conflicts: readonly { readonly mapId: string; readonly name: string }[] }
  | { readonly kind: "disabled" }
  | { readonly kind: "not-configured" }
  | { readonly kind: "not-loaded" }
  | { readonly kind: "saved" }
  | { readonly kind: "saved-local" };

const mocks = vi.hoisted(() => ({
  flush: vi.fn<() => Promise<MockFlushResult>>(),
  toast: vi.fn<(message: string, kind?: "info" | "ok" | "error") => void>(),
}));

vi.mock("@/project/store", () => ({
  store: {
    flush: mocks.flush,
  },
}));

vi.mock("@/util/toast", () => ({
  toast: mocks.toast,
}));

describe("saveProjectNow", () => {
  beforeEach(() => {
    mocks.flush.mockReset();
    mocks.toast.mockReset();
  });

  it("shows a saving toast immediately and a completion toast after flush resolves", async () => {
    const pendingSave = deferred<MockFlushResult>();
    mocks.flush.mockReturnValueOnce(pendingSave.promise);

    const savePromise = saveProjectNow();

    expect(mocks.toast).toHaveBeenNthCalledWith(1, "저장 중...", "info");

    pendingSave.resolve({ kind: "saved" });
    await expect(savePromise).resolves.toBe(true);
    expect(mocks.toast).toHaveBeenNthCalledWith(2, "저장 완료", "ok");
  });
});

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolveValue: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  if (!resolveValue) throw new Error("deferred promise resolver was not initialized");
  return { promise, resolve: resolveValue };
}
