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
    const writeStatus = vi.fn();

    expect(await applyDatabaseChanges(writeStatus)).toBe(false);
    expect(writeStatus).toHaveBeenCalledWith({ kind: "error", text: expect.stringContaining("기록하지 않았습니다") });
    expect(toast).not.toHaveBeenCalledWith(expect.any(String), "ok");
  });

  it("reports an actual browser write as saved", async () => {
    vi.mocked(store.flush).mockResolvedValue({ kind: "saved-local", written: true });
    const writeStatus = vi.fn();

    expect(await applyDatabaseChanges(writeStatus)).toBe(true);
    expect(writeStatus).toHaveBeenCalledWith({ kind: "ok", text: expect.stringContaining("브라우저") });
  });

  it("does not label canonical folder saves as online storage", async () => {
    vi.mocked(store.flush).mockResolvedValue({ kind: "saved" });
    const writeStatus = vi.fn();

    expect(await applyDatabaseChanges(writeStatus)).toBe(true);
    expect(writeStatus).toHaveBeenCalledWith({ kind: "ok", text: "변경 내용을 저장했습니다." });
    expect(toast).toHaveBeenCalledWith("저장했습니다.", "ok");
  });
});
