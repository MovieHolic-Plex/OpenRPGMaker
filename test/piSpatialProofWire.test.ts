import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { adoptSpatialToolProof, authorMergedSpatialProposal, exportSpatialToolProof } from "@/editor/tools/spatialToolState";
import { runTool } from "@/editor/tools/toolRunner";
import { mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { own } from "@/project/spatial/domain";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { fixtureDocument, spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";

const ROOM = "Accepted room";

function options(...toolNames: string[]) {
  const live = store.getCurrent();
  return {
    base: captureProposalBase(live),
    baseline: new AuthoredProjectBaseline(live),
    source: "agent" as const,
    summary: "Canonical wire probe",
    toolNames,
  };
}

/** 동반 서비스가 돌려주는 모양: JSON 사본이고, 편집기 전용 메모리는 실리지 않는다. */
function wire(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

function authoredDraft(): Project {
  const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
  const design = own(fixtureDocument(ctx.project).library.spaces, spaceDesign);
  const result = runTool(ctx, "upsert_spatial_design", {
    kind: "space", expectedRevision: 1, space: { ...design, revision: 2, name: ROOM },
  });
  expect(result.ok, result.summary).toBe(true);
  return ctx.project;
}

function renamedMapDraft(): Project {
  const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
  const result = runTool(ctx, "set_map_properties", { mapId: ctx.project.startMapId, name: "MERGED title" });
  expect(result.ok, result.summary).toBe(true);
  return ctx.project;
}

beforeEach(() => {
  vi.stubEnv("VITE_LEGACY_DB_URL", "");
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "");
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(spaceCompilerFixture());
  resetMapEditHistory();
});
afterEach(() => { vi.unstubAllEnvs(); resetMapEditHistory(); });

it("동반 서비스가 실어 보낸 증거로 계층 변경이 적용된다", async () => {
  // Given: the worker ran the canonical tool and sealed the proposal in its own process.
  const draft = authoredDraft();
  const proof = exportSpatialToolProof(draft);
  expect(proof).not.toBeNull();
  // When: the browser adopts the wire digests, as the /pi client does before applying.
  const incoming = wire(draft);
  adoptSpatialToolProof(incoming, proof, store.getCurrent());
  const applied = await applyProposedProject(incoming, options("upsert_spatial_design"));
  // Then
  expect(applied.ok, JSON.stringify(applied)).toBe(true);
  expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.revision).toBe(2);
});

it("증거 없는 계층 제안은 반려된다", async () => {
  // Given: the same worker output without its proof.
  const incoming = wire(authoredDraft());
  // When
  const applied = await applyProposedProject(incoming, options("upsert_spatial_design"));
  // Then
  expect(applied).toMatchObject({ ok: false, reason: "commit-rejected", issue: "Spatial hierarchy changes require the validated spatial tools" });
  expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.revision).toBe(1);
});

it("증거 없는 일반 편집도 canonical 프로젝트에서는 반려된다", async () => {
  // Given: map-only work, which is what /pi team does on a canonical project.
  const incoming = wire(renamedMapDraft());
  // When
  const applied = await applyProposedProject(incoming, options("set_map_properties"));
  // Then: the exact message the /pi panel renders as 적용 실패.
  expect(applied).toMatchObject({ ok: false, reason: "commit-rejected", issue: "Canonical AI acceptance requires an issued tool proposal" });
});

it("기준이 움직인 뒤의 증거는 되붙지 않는다", async () => {
  // Given: a live edit between the worker run and adoption.
  const draft = authoredDraft();
  const proof = exportSpatialToolProof(draft);
  store.update(project => { project.meta.author = "LIVE EDIT"; });
  // When
  const incoming = wire(draft);
  adoptSpatialToolProof(incoming, proof, store.getCurrent());
  // Then
  expect(exportSpatialToolProof(incoming)).toBeNull();
});

it("병합을 거친 제안은 살아있는 문서 기준으로 승인을 다시 받는다", async () => {
  // Given: the same merge the /pi client performs for a map-scoped run.
  const live = store.getCurrent();
  const merged = mergeMapBundles(live, [{ mapIds: [live.startMapId], project: renamedMapDraft() }]);
  expect(exportSpatialToolProof(merged.project)).toBeNull();
  // When
  authorMergedSpatialProposal(merged.project, live);
  const applied = await applyProposedProject(merged.project, options("set_map_properties"));
  // Then
  expect(applied.ok, JSON.stringify(applied)).toBe(true);
  expect(store.getCurrent().maps[store.getCurrent().startMapId]?.name).toBe("MERGED title");
});

it("병합이 실어 온 계층 편집은 병합 승인으로 세탁되지 않는다", async () => {
  // Given: a hierarchy edit riding along with a bundle merge.
  const live = store.getCurrent();
  const merged = mergeMapBundles(live, [{ mapIds: [live.startMapId], project: renamedMapDraft() }]);
  const document = fixtureDocument(store.getCurrent());
  merged.project.spatialAuthoring = { ...document, library: { ...document.library, spaces: { ...document.library.spaces, [spaceDesign]: { ...own(document.library.spaces, spaceDesign), revision: 2 } } } };
  // When
  authorMergedSpatialProposal(merged.project, live);
  const applied = await applyProposedProject(merged.project, options("set_map_properties"));
  // Then
  expect(applied).toMatchObject({ ok: false, reason: "commit-rejected", issue: "Spatial hierarchy changes require the validated spatial tools" });
});
