import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordProjectSnapshot, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { resetMonsterMetadataOverride, setMonsterMetadataOverride } from "@/project/monsterMetadata";
import { getMonsterResource } from "@/assets/monsterResourceCatalog";
import { audioDescriptionProject } from "./helpers/audioDescriptionPersistenceTransport";

const id = "generated-enemy-slime-01";
beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(audioDescriptionProject(undefined));
  resetMapEditHistory();
});
afterEach(() => {
  resetMapEditHistory();
  vi.unstubAllEnvs();
});

describe("monster metadata history", () => {
  it("restores inherited metadata when an applied project edit is undone", () => {
    // Given
    const before = getMonsterResource(store.getCurrent(), id);
    recordProjectSnapshot("metadata apply");
    store.update(project => { project.monsterMetadata = setMonsterMetadataOverride(project.monsterMetadata, id, { name: "USER", tags: [], description: "" }); }, { scope: "assets", label: "metadata apply" });
    // When
    const undone = undoMapEdit();
    // Then
    expect(undone).toBe(true);
    expect(store.getCurrent().monsterMetadata).toBeUndefined();
    expect(getMonsterResource(store.getCurrent(), id)).toEqual(before);
  });

  it("restores authored metadata when an undone edit is redone", () => {
    // Given
    recordProjectSnapshot("metadata apply");
    store.update(project => { project.monsterMetadata = setMonsterMetadataOverride(project.monsterMetadata, id, { name: "USER", tags: ["USER_TAG"] }); }, { scope: "assets", label: "metadata apply" });
    const authored = getMonsterResource(store.getCurrent(), id);
    undoMapEdit();
    // When
    const redone = redoMapEdit();
    // Then
    expect(redone).toBe(true);
    expect(getMonsterResource(store.getCurrent(), id)).toEqual(authored);
  });

  it("restores explicit clears and unknown IDs when a reset is undone", () => {
    // Given
    store.update(project => { project.monsterMetadata = { [id]: { tags: [], description: "" }, orphan: { name: "ORPHAN" } }; });
    const before = structuredClone(store.getCurrent().monsterMetadata);
    recordProjectSnapshot("metadata reset");
    store.update(project => {
      const result = resetMonsterMetadataOverride(project.monsterMetadata, id);
      if (result === undefined) delete project.monsterMetadata;
      else project.monsterMetadata = result;
    }, { scope: "assets", label: "metadata reset" });
    // When
    const undone = undoMapEdit();
    // Then
    expect(undone).toBe(true);
    expect(store.getCurrent().monsterMetadata).toEqual(before);
  });
});
