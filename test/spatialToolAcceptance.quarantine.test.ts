import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { runTool } from "@/editor/tools/toolRunner";
import { resetMapEditHistory, undoMapEdit, redoMapEdit } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { fixtureDocument, spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { own } from "@/project/spatial/domain";

const options = { source: "agent", summary: "Spatial acceptance", toolNames: ["upsert_spatial_design"] } as const;
beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(spaceCompilerFixture());
  resetMapEditHistory();
});
afterEach(() => { vi.unstubAllEnvs(); resetMapEditHistory(); });
function sourceProposal() {
  const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
  const design = own(fixtureDocument(ctx.project).library.spaces, spaceDesign);
  const result = runTool(ctx, "upsert_spatial_design", { kind: "space", expectedRevision: 1, space: { ...design, revision: 2, name: "Accepted room" } });
  expect(result.ok, result.summary).toBe(true);
  return ctx.project;
}
describe("spatial proposals at the actual shared acceptance boundary", () => {
  it("accepts the authored source in one reversible transaction", async () => {
    // Given
    const before = JSON.stringify(store.getCurrent());
    const proposed = sourceProposal();
    // When
    const result = await applyProposedProject(proposed, options);
    // Then
    expect(result.ok).toBe(true);
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.revision).toBe(2);
    const after = JSON.stringify(store.getCurrent());
    expect(undoMapEdit()).toBe(true);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(redoMapEdit()).toBe(true);
    expect(JSON.stringify(store.getCurrent())).toBe(after);
  });
  it.each(["source", "map", "identity"])("rejects a changed live %s before any publication", async change => {
    // Given
    const proposed = sourceProposal();
    if (change === "source") store.update(project => { project.meta.title = "Other live edit"; });
    if (change === "map") store.update(project => { own(project.maps, project.startMapId).name = "Other map"; });
    if (change === "identity") store.replace(structuredClone(store.getCurrent()), { change: { projectSwitch: true } });
    const before = JSON.stringify(store.getCurrent());
    // When
    const result = await applyProposedProject(proposed, options);
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });
  it("rejects a forged project snapshot even when its spatial document is unchanged", async () => {
    // Given
    const proposed = structuredClone(store.getCurrent());
    own(proposed.maps, proposed.startMapId).name = "Forged map replacement";
    const before = JSON.stringify(store.getCurrent());
    // When
    const result = await applyProposedProject(proposed, options);
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });
  it("rejects map tampering after a valid tool proposal was issued", async () => {
    // Given
    const proposed = sourceProposal();
    own(proposed.maps, proposed.startMapId).name = "Tampered after tool completion";
    const before = JSON.stringify(store.getCurrent());
    // When
    const result = await applyProposedProject(proposed, options);
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });
  it("rejects a stale generic map proposal in canonical mode", async () => {
    // Given
    const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
    const result = runTool(ctx, "set_map_properties", { mapId: ctx.project.startMapId, name: "AI title" });
    expect(result.ok, result.summary).toBe(true);
    store.update(project => { own(project.maps, project.startMapId).name = "Live title"; });
    const before = JSON.stringify(store.getCurrent());
    // When
    const applied = await applyProposedProject(ctx.project, { ...options, toolNames: ["set_map_properties"] });
    // Then
    expect(applied.ok).toBe(false);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });
});
