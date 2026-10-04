import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyDatabaseChanges } from "@/editor/panels/databaseModalPersistence";
import { store } from "@/project/store";
import { toast } from "@/util/toast";

vi.mock("@/project/store", () => ({ store: { flush: vi.fn() } }));
vi.mock("@/util/toast", () => ({ toast: vi.fn() }));

describe("database save feedback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not mark skipped temporary-session writes as saved", async () => {
    vi.mocked(store.flush).mockResolvedValue({ kind: "saved-local", written: false });
    const status = { textContent: "", dataset: {} } as HTMLElement;

    expect(await applyDatabaseChanges(status)).toBe(false);
    expect(status.dataset.statusKind).toBe("error");
    expect(status.textContent).toContain("기록하지 않았습니다");
    expect(toast).not.toHaveBeenCalledWith(expect.any(String), "ok");
  });

  it("reports an actual browser write as saved", async () => {
    vi.mocked(store.flush).mockResolvedValue({ kind: "saved-local", written: true });
    const status = { textContent: "", dataset: {} } as HTMLElement;

    expect(await applyDatabaseChanges(status)).toBe(true);
    expect(status.dataset.statusKind).toBe("ok");
    expect(status.textContent).toContain("브라우저");
  });

  it("does not label canonical folder saves as online storage", async () => {
    vi.mocked(store.flush).mockResolvedValue({ kind: "saved" });
    const status = { textContent: "", dataset: {} } as HTMLElement;

    expect(await applyDatabaseChanges(status)).toBe(true);
    expect(status.dataset.statusKind).toBe("ok");
    expect(status.textContent).not.toContain("온라인");
    expect(toast).toHaveBeenCalledWith("저장했습니다.", "ok");
  });
});
