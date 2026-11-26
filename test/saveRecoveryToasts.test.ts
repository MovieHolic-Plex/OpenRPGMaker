/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closePersistenceRecovery } from "@/editor/persistenceRecoveryUi";
import { reloadProjectFromDbNow, saveProjectNow } from "@/editor/saveActions";
import { createBlankProject } from "@/project/defaults";
import { SpatialPersistenceError } from "@/project/spatial/persistenceTypes";
import { ProjectRoutingError } from "@/project/spatial/saveRouting";
import { store } from "@/project/store";
import { setProjectRepositoryForTest } from "@/project/persistence/repository";
import type { ProjectRepository } from "@/project/persistence/types";
import { resetToastsForTest, toast } from "@/util/toast";

vi.mock("@/editor/editorState", () => ({ editorState: { get: () => ({ currentMapId: null }) } }));
vi.mock("@/editor/mapSelection", () => ({ focusProjectStartMap: vi.fn() }));

// 저장 대상은 세션의 저장소가 정본이다 — 설정 모듈을 목킹하면 코드가 더 이상 읽지 않아 목이 죽는다.
let liveTarget = { url: "http://127.0.0.1:9", projectId: "recovery-fixture", anonKey: "local" };

beforeEach(() => {
  liveTarget = { url: "http://127.0.0.1:9", projectId: "recovery-fixture", anonKey: "local" };
  setProjectRepositoryForTest({
    kind: "remote",
    currentTarget: () => liveTarget,
  } as unknown as ProjectRepository);
  vi.useFakeTimers();
  vi.spyOn(store, "isLoaded").mockReturnValue(true);
  vi.spyOn(store, "hasUnsavedChanges").mockReturnValue(true);
  vi.spyOn(store, "getCurrent").mockReturnValue(createBlankProject());
  vi.spyOn(store, "subscribe").mockImplementation(() => () => undefined);
  vi.spyOn(store, "getDbPersistenceStatus").mockReturnValue({
    kind: "ready", projectId: "recovery-fixture", source: "env", url: "http://127.0.0.1:9",
  });
  vi.spyOn(store, "reloadFromRemote").mockResolvedValue({
    kind: "reloaded", title: "remote", projectId: "recovery-fixture",
  });
});

afterEach(() => {
  closePersistenceRecovery();
  resetToastsForTest();
  document.body.replaceChildren();
  setProjectRepositoryForTest(null);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function latestToast(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-testid="toast"]');
  if (!element) throw new Error("Expected a toast element");
  return element;
}

describe("recovery notification ownership", () => {
  it.each([
    new SpatialPersistenceError("conflict", "stale token", 409),
    new ProjectRoutingError("activation-stale", "local edits"),
  ])("preserves unrelated errors when recovery reload succeeds after $code", async (error) => {
    // Given: a real recovery notification and an unrelated error with identical display text.
    vi.spyOn(store, "flush").mockRejectedValue(error);
    vi.spyOn(store, "getPersistenceRecovery").mockReturnValue({ kind: "blocked", error, actions: ["reload", "export-copy"] });
    await saveProjectNow();
    const recoveryToast = latestToast();
    // #4922: 같은 문구·같은 종류의 동작 없는 토스트는 새로 쌓지 않고 떠 있는 것의 시간만 다시 잰다.
    // 문구가 같아도 따로 떠 있는 무관한 오류를 만들려면 자기 동작을 가진 오류 토스트여야 한다.
    toast(recoveryToast.querySelector(".toast-message")?.textContent ?? "", {
      kind: "error",
      action: { label: "자세히", onClick: () => undefined },
    });
    const unrelatedToast = latestToast();
    expect(unrelatedToast).not.toBe(recoveryToast);

    // When: the captured project reload succeeds.
    const result = await reloadProjectFromDbNow({ force: true, expectedProjectId: "recovery-fixture" });

    // Then: only the recovery-owned error is removed, independently of display prose.
    expect(result).toBe(true);
    expect(recoveryToast.isConnected).toBe(false);
    expect(unrelatedToast.isConnected).toBe(true);
    expect(unrelatedToast.classList.contains("show")).toBe(true);
  });

  it.each(["target-changed", "failed"] as const)("retains recovery errors when reload is %s", async (outcome) => {
    // Given: an unresolved recovery notification.
    const error = new SpatialPersistenceError("conflict", "stale token", 409);
    vi.spyOn(store, "flush").mockRejectedValue(error);
    vi.spyOn(store, "getPersistenceRecovery").mockReturnValue({ kind: "blocked", error, actions: ["reload", "export-copy"] });
    await saveProjectNow();
    const recoveryToast = latestToast();
    vi.mocked(store.reloadFromRemote).mockResolvedValue({ kind: "failed", message: "offline", projectId: "recovery-fixture" });

    // When: reload fails or rejects a different captured project.
    const result = await reloadProjectFromDbNow({
      force: true, expectedProjectId: outcome === "target-changed" ? "other-fixture" : "recovery-fixture",
    });

    // Then: unsuccessful recovery leaves its error visible.
    expect(result).toBe(false);
    expect(recoveryToast.isConnected).toBe(true);
    expect(recoveryToast.classList.contains("show")).toBe(true);
  });
});
