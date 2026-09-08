/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import type { SpatialAuthoringDraft, SpatialAuthoringResult } from "../src/editor/spatial/authoringTypes";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { own } from "../src/project/spatial/domain";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("rejects a foreign preview when another controller is asked to issue a continuation", () => {
  // Given an authentic preview from a different controller.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  // When authority is requested from a different issuer.
  const result = createSpatialAuthoringController().continueDraft(preview);
  // Then matching project content cannot transfer controller authority.
  expect(result).toMatchObject({ kind: "error", error: { code: "foreign-preview" } });
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it.each([false, true])("rejects a fabricated checkpoint when copied output is modified=%s", modify => {
  // Given a copied preview wrapper, optionally carrying forged raster output.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  const fabricated = structuredClone(preview);
  if (modify) own(fabricated.project.maps, f.target.mapId).lowerTiles[0] = 42;
  const before = structuredClone(store.getCurrent());
  // When the copy is submitted as a continuation checkpoint.
  const result = f.controller.continueDraft(fabricated);
  // Then even byte-identical generated output is not an issued capability.
  expect(result).toMatchObject({ kind: "error", error: { code: "foreign-preview" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("keeps its checkpoint immutable when the issued continuation draft is mutated", () => {
  // Given an authorized continuation whose editable copy is separate from the frozen checkpoint.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  const expected = structuredClone(preview.project);
  const continued = authoringValue(f.controller.continueDraft(preview));
  own(continued.project.maps, f.target.mapId).lowerTiles[0] = 42;
  // When the mutated copy is previewed without a raster ownership operation.
  const result = f.controller.preview(continued, { operation: { kind: "edit" } });
  // Then mutation cannot rewrite the private checkpoint and authorize itself.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(preview.project).toEqual(expected);
  expect(Object.isFrozen(preview.project)).toBe(true);
  expect(Object.isFrozen(own(preview.project.maps, f.target.mapId).lowerTiles)).toBe(true);
});

it("rejects a continued draft when live state changes after continuation issuance", () => {
  // Given a continuation already issued against the original project fingerprint.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  const continued = authoringValue(f.controller.continueDraft(preview));
  store.getCurrent().meta.title = "Live change after issuance";
  const before = structuredClone(store.getCurrent());
  // When previewing against the old live baseline.
  const result = f.controller.preview(continued, { operation: { kind: "edit" } });
  // Then a genuine checkpoint cannot mask live-state staleness.
  expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it.each([false, true])("rejects an accepted preview when the original baseline is restored (compiled=%s)", compile => {
  // Given an accepted preview whose exact original project has been restored by undo.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  const accepted = compile ? preview : authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" } }));
  authoringValue(f.controller.apply(accepted));
  expect(f.controller.undo()).toBe(compile);
  const before = structuredClone(store.getCurrent());
  // When continuation attempts to reuse the spent preview (including a no-op acceptance).
  const result = f.controller.continueDraft(accepted);
  // Then undo does not resurrect the capability.
  expect(result).toMatchObject({ kind: "error", error: { code: "already-applied" } });
  expect(store.getCurrent()).toEqual(before);
});

it("rejects continuation when the project switches to identical content under a new identity", () => {
  // Given an old preview and an identical-content local project switch.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  store.replaceProject(structuredClone(store.getCurrent()));
  const before = structuredClone(store.getCurrent());
  // When continuing across project identities.
  const result = f.controller.continueDraft(preview);
  // Then content equality cannot substitute for the original project identity.
  expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("rejects an in-flight preview when a synchronous observer undoes adoption and continues", () => {
  // Given the real synchronous publication seam and a subscriber restoring the exact baseline.
  const f = authoringFixture();
  const before = structuredClone(store.getCurrent());
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  let observed = false;
  const undo: boolean[] = [];
  const continuation: SpatialAuthoringResult<SpatialAuthoringDraft>[] = [];
  const release = store.subscribe(() => {
    if (observed) return;
    observed = true;
    undo.push(f.controller.undo());
    continuation.push(f.controller.continueDraft(preview));
  });
  try {
    // When the accepted preview enters synchronous publication.
    const result = f.controller.apply(preview);
    // Then the same consumed guard protects continuation before apply has returned.
    expect(result).toMatchObject({ kind: "ok", value: { changed: true } });
    expect(undo).toEqual([true]);
    expect(continuation).toMatchObject([{ kind: "error", error: { code: "already-applied" } }]);
    expect(store.getCurrent()).toEqual(before);
  } finally { release(); }
});
