import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installElectronBridgeSession, type ElectronBridgeSession } from "./support/electronBridgeSession";

let session: ElectronBridgeSession | null = null;

// 저장 증명의 포트 층 계약: 영수증·계보·재적재 — 로컬 폴더 정본에서도 살아야 하는 성질이다.
beforeEach(async () => {
  session = await installElectronBridgeSession({
    projectDir: "/tmp/oprn-proof-fixture",
    projectId: "p1-proof-fixture",
    project: createBlankProject(),
  });
});

afterEach(() => {
  session?.dispose();
  session = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("저장 영수증의 계보 (Electron 브리지)", () => {
  it("flush 영수증의 sha256 이 브리지에 남은 문서의 해시와 같다", async () => {
    store.replaceProject(createBlankProject());
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(null);
    store._setCleanPersistStateForTest();
    store.update((draft) => {
      draft.meta.title = "proof-fixture";
    });

    const result = await store.flush();

    expect(result.kind).toBe("saved");
    const receipt = (result as { receipt?: { projectId: string; sha256?: string } }).receipt;
    expect(receipt?.projectId).toBe("p1-proof-fixture");
    expect(receipt?.sha256).toMatch(/^[0-9a-f]{64}$/);

    const stored = session!.storedSerialized();
    expect(stored).not.toBeNull();
    expect(JSON.parse(String(stored)).meta.title).toBe("proof-fixture");
    expect(session!.calls.save).toBe(1);
  });

  it("저장이 끝나면 커밋 기록이 그 저장을 따라온다", async () => {
    store.replaceProject(createBlankProject());
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(null);
    store._setCleanPersistStateForTest();
    store.update((draft) => {
      draft.meta.title = "commit-follows";
    });

    const result = await store.flush();
    expect(result.kind).toBe("saved");

    const inputs = session!.commitInputs() as readonly { projectDir?: string; summary?: string }[];
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    expect(inputs.at(-1)?.projectDir).toBe("/tmp/oprn-proof-fixture");
    expect(inputs.at(-1)?.summary).toContain("변경 저장");
  });

  it("저장된 내용은 다시 열어도 그대로다 (계보가 끊기지 않는다)", async () => {
    store.replaceProject(createBlankProject());
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(null);
    store._setCleanPersistStateForTest();
    store.update((draft) => {
      draft.meta.title = "reopen-same";
    });
    const first = await store.flush();
    expect(first.kind).toBe("saved");

    const wireBefore = session!.storedSerialized();
    store._setCleanPersistStateForTest();

    const second = await store.flush();

    expect(second.kind).toBe("saved");
    expect(session!.storedSerialized()).toBe(wireBefore);
    expect(session!.calls.save).toBe(1);
  });
});
