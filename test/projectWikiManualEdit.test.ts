import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { createWorldPanelState, draftFromEntity, saveDraft } from "@/editor/panels/worldManager";
import type { WorldEntity } from "@/project/world";

describe("codex concurrent document editing", () => {
  it("does not overwrite a document changed after the manual draft opened", () => {
    const original: WorldEntity = {
      id: "w_rule", type: "guideline", name: "Rule", summary: "Original", origin: "user",
    };
    const project = createBlankProject();
    project.world = { entities: [original], relations: [] };
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    const state = createWorldPanelState();
    state.editDraft = draftFromEntity(original, []);
    state.editDraft.summary = "Pending manual draft";
    const live = { ...original, summary: "Newer saved correction" };
    store.update((current) => { current.world = { entities: [live], relations: [] }; });

    saveDraft(state, project.world);

    expect(store.getCurrent().world?.entities[0]?.summary).toBe("Newer saved correction");
    expect(state.editDraft?.summary).toBe("Pending manual draft");
    expect(state.editError).not.toBe("");
  });

  it("does not recreate a document deleted while a manual draft was open", () => {
    const original: WorldEntity = {
      id: "w_rule", type: "guideline", name: "Rule", summary: "Original", origin: "user",
    };
    const project = createBlankProject();
    project.world = { entities: [], relations: [] };
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    const state = createWorldPanelState();
    state.editDraft = draftFromEntity(original, []);
    state.editDraft.summary = "Pending draft";

    saveDraft(state, project.world);

    expect(store.getCurrent().world?.entities).toEqual([]);
    expect(state.editError).not.toBe("");
  });
});
