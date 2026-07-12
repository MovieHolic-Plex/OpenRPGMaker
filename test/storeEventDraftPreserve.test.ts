import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import type { Project } from "@/project/types";

vi.mock("@/project/supabaseProjectSync", () => ({
  loadProjectFromSupabase: vi.fn(async () => null),
  saveProjectToSupabase: vi.fn(async (project: Project) => ({ kind: "saved" as const, project })),
  saveProjectMapPatchToSupabase: vi.fn(async (input: { project: Project }) => ({
    kind: "saved" as const,
    project: structuredClone(input.project),
  })),
}));

vi.mock("@/assets/supabaseResourceCache", () => ({
  cacheSupabaseRootResources: vi.fn(async () => undefined),
}));

vi.mock("@/project/projectCommitLog", () => ({
  recordManualProjectCommitAfterSave: vi.fn(),
  resetManualProjectCommitBaseline: vi.fn(),
}));

describe("store preserves open event drafts across remote autosave", () => {
  beforeEach(() => {
    vi.resetModules();
    _resetEventDraftVaultForTest();
  });

  afterEach(() => {
    _resetEventDraftVaultForTest();
    vi.clearAllMocks();
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
