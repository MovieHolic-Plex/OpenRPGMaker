import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installElectronBridgeSession } from "./support/electronBridgeSession";

let disposeBridgeSession: (() => void) | null = null;

afterEach(() => {
  disposeBridgeSession?.();
  disposeBridgeSession = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("store flush 직렬화 (Electron 브리지)", () => {
  it("앞 저장이 in-flight 인 동안 뒤 저장은 저장을 시작하지 않는다", async () => {
    const session = await installElectronBridgeSession({ project: createBlankProject() });
    disposeBridgeSession = session.dispose;
    const gate = session.holdNextSave();

    store.replaceProject(createBlankProject());
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(null);
    store._setCleanPersistStateForTest();
    store.update((draft: Project) => {
      draft.meta.title = "A";
    });

    const first = store.flush();
    await gate.entered();
    expect(session.calls.save).toBe(1);

    store.update((draft: Project) => {
      draft.meta.title = "B";
    });
    const second = store.flush();
    await Promise.resolve();
    expect(session.calls.save).toBe(1);

    gate.release();
    await Promise.all([first, second]);
    // 두 번째 flush 는 새 저장을 시작하는 대신 앞 저장에 합쳐진다 — 그래도 최신 내용은 남아야 한다.
    const stored = session.storedSerialized();
    expect(stored).not.toBeNull();
    expect(JSON.parse(String(stored)).meta.title).toBe("B");
    expect(session.calls.save).toBeGreaterThanOrEqual(1);
  });

  it("배경 커밋 기록이 in-flight 인 동안 두 번째 flush 도 커밋을 중복으로 내지 않는다", async () => {
    const session = await installElectronBridgeSession({ project: createBlankProject() });
    disposeBridgeSession = session.dispose;

    store.replaceProject(createBlankProject());
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(null);
    store._setCleanPersistStateForTest();
    store.update((draft: Project) => {
      draft.meta.title = "C";
    });

    const gate = session.holdNextCommit();
    const first = store.flush();
    await gate.entered();
    expect(session.calls.commit).toBe(1);

    const second = store.flush();
    await Promise.resolve();
    expect(session.calls.commit).toBe(1);

    gate.release();
    await Promise.all([first, second]);
    expect(session.calls.commit).toBeGreaterThanOrEqual(1);
  });
});
