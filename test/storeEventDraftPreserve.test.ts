import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import type { MemoryRepository } from "@/project/persistence/memoryRepository";
import type { MemoryProjectSession } from "./support/projectSession";

vi.mock("@/project/projectCommitLog", () => ({
  recordManualProjectCommitAfterSave: vi.fn(),
  resetManualProjectCommitBaseline: vi.fn(),
}));

let session: MemoryProjectSession | null = null;
let saveSpy: MockInstance<MemoryRepository["save"]> | null = null;
let patchSpy: MockInstance<MemoryRepository["saveMapPatch"]> | null = null;

describe("store preserves open event drafts across autosave", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    // 전송 목 대신 저장소를 심고 그 save/saveMapPatch 를 본다 — 검증 대상은 "무엇을 제출했는가" 다.
    const { installMemoryProjectSession } = await import("./support/projectSession");
    session = installMemoryProjectSession();
    saveSpy = vi.spyOn(session.repository, "save");
    patchSpy = vi.spyOn(session.repository, "saveMapPatch");
    _resetEventDraftVaultForTest();
  });

  afterEach(() => {
    _resetEventDraftVaultForTest();
    session?.dispose();
    session = null;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("autosave submits canonical linked profiles and preserves the staged name for Apply", async () => {
    const { store } = await import("@/project/store");
    const { createEventDraft, setEventDraftCharacterName, saveEventDraft } = await import("@/editor/eventDraftActions");
    store.replaceProject(createBlankProject());
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 3, 3);
    setEventDraftCharacterName(mapId, eventId, "autosave-npc", "Staged name");
    const result = await store.flush();
    expect(result.kind).toBe("saved");
    const submitted = [
      ...(saveSpy?.mock.calls ?? []).map(([project]) => project),
      ...(patchSpy?.mock.calls ?? []).map(([input]) => input.project),
    ];
    expect(submitted.length).toBeGreaterThan(0);
    for (const project of submitted) expect(project.characters?.["autosave-npc"]).toBeUndefined();
    expect(store.getCurrent().characters?.["autosave-npc"]).toBeUndefined();
    saveEventDraft(mapId, eventId);
    expect(store.getCurrent().characters?.["autosave-npc"]?.displayName).toBe("Staged name");
  });

  it("keeps a new event draft after map-patch save returns a draft-stripped project", async () => {
    const { store } = await import("@/project/store");
    const { createEventDraft } = await import("@/editor/eventDraftActions");
    const project = createBlankProject();
    store.replaceProject(project);
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
    store._setPersistedBaselineForTest(structuredClone(projectWithoutEventDrafts(store.getCurrent())));

    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 8, 9);
    expect(store.getCurrent().maps[mapId].events.some((event) => event.id === eventId)).toBe(true);

    const result = await store.flush();
    expect(result.kind).toBe("saved");

    const kept = store.getCurrent().maps[mapId].events.find((event) => event.id === eventId);
    expect(kept).toBeDefined();
    expect(kept?.draft?.kind).toBe("new");
    expect(kept?.x).toBe(8);
    expect(kept?.y).toBe(9);
  });
});
