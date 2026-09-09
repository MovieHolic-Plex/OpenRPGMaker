import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { Project } from "@/project/types";

vi.mock("@/project/supabaseProjectSync", () => ({
  loadProjectFromSupabase: vi.fn(async (): Promise<Project | null> => null),
  saveProjectToSupabase: vi.fn(async (project: Project) => ({ kind: "saved" as const, project })),
  saveProjectMapPatchToSupabase: vi.fn(async (input: { project: Project }) => ({
    kind: "saved" as const,
    project: structuredClone(input.project),
  })),
}));

vi.mock("@/assets/supabaseResourceCache", () => ({
  cacheSupabaseRootResources: vi.fn(async () => ({ skipped: [] })),
}));

vi.mock("@/project/projectCommitLog", () => ({
  recordManualProjectCommitAfterSave: vi.fn(),
  resetManualProjectCommitBaseline: vi.fn(),
}));

describe("store preserves open event drafts across remote autosave", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("localStorage", undefined);
    vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
    vi.stubEnv("VITE_SUPABASE_URL", "https://draft-save.invalid");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fixture-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "draft-save-fixture");
    const { store } = await import("@/project/store");
    const { loadProjectFromSupabase } = await import("@/project/supabaseProjectSync");
    vi.mocked(loadProjectFromSupabase).mockResolvedValueOnce(createBlankProject());
    await store.load();
    expect(store.getLoadedConnection()).toEqual({
      url: "https://draft-save.invalid", anonKey: "fixture-anon-key", projectId: "draft-save-fixture",
    });
    expect(store.getLoadedProjectIdentity()).toEqual({
      backend: "supabase:https://draft-save.invalid:rpg_zzu", projectId: "draft-save-fixture",
    });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { _resetEventDraftVaultForTest } = await import("@/project/eventDraftVault");
    _resetEventDraftVaultForTest();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("autosave submits canonical linked profiles and preserves the staged name for Apply", async () => {
    const { store } = await import("@/project/store");
    const { createEventDraft, setEventDraftCharacterName, saveEventDraft } = await import("@/editor/eventDraftActions");
    const { saveProjectToSupabase, saveProjectMapPatchToSupabase } = await import("@/project/supabaseProjectSync");
    store.replaceProject(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 3, 3);
    setEventDraftCharacterName(mapId, eventId, "autosave-npc", "Staged name");
    const result = await store.flush();
    expect(result.kind).toBe("saved");
    const submitted = [
      ...vi.mocked(saveProjectToSupabase).mock.calls.map(([project]) => project),
      ...vi.mocked(saveProjectMapPatchToSupabase).mock.calls.map(([input]) => input.project),
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
