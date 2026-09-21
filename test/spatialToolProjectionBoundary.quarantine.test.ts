import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { resetMapEditHistory, undoMapEdit, redoMapEdit } from "@/editor/mapEditHistory";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { beginSpatialToolProposal, sealSpatialToolProposal } from "@/editor/tools/spatialToolState";
import { runTool } from "@/editor/tools/toolRunner";
import { deserialize, serialize } from "@/project/io";
import { ProjectFormatError } from "@/project/io/errors";
import { projectLint } from "@/project/lint/projectLint";
import { own } from "@/project/spatial/domain";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";

const options = { source: "agent", summary: "Projection boundary", toolNames: ["upsert_map_connection"] } as const;

function overviewConnection(project: Project, prefix = "spatial-enter:") {
  const connection = project.mapConnections?.find(candidate => candidate.id.startsWith(prefix));
  if (!connection) throw new TypeError("Compiled fixture must contain an overview connection");
  return connection;
}

function reloadError(project: Project): string | null {
  try {
    deserialize(serialize(project));
    return null;
  } catch (error) {
    if (!(error instanceof ProjectFormatError)) throw error;
    return error.message;
  }
}

beforeEach(() => {
  vi.stubEnv("VITE_LEGACY_DB_URL", "");
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "");
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const compiled = compileSpatialOccurrence(geographyFixture("region", 109), { occurrenceId: geographyRoot });
  expect(reloadError(compiled)).toBeNull();
  store.replace(compiled);
  resetMapEditHistory();
});
afterEach(() => { vi.unstubAllEnvs(); resetMapEditHistory(); });

describe("full canonical projection at generic runner and acceptance boundaries", () => {
  it.each([false, true])("rejects registered NPC disabling when an invalid name already exists: %s", async existingError => {
    // Given: exact T17-AV-1 fixture; the clean baseline is the rejection control.
    const connection = overviewConnection(store.getCurrent());
    if (existingError) connection.name = "Manual projection name";
    expect(reloadError(store.getCurrent()) === null).toBe(!existingError);
    const before = JSON.stringify(store.getCurrent());
    const spatial = JSON.stringify(store.getCurrent().spatialAuthoring);
    const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
    // When: actual registered runner -> shared acceptance -> store/history -> deserialize.
    const runner = runTool(ctx, "upsert_map_connection", { connection: { ...connection, npcEnabled: false } });
    const accepted = runner.ok ? await applyProposedProject(ctx.project, options) : undefined;
    const acceptedJson = JSON.stringify(store.getCurrent());
    const publishedReloadError = accepted?.ok ? reloadError(store.getCurrent()) : null;
    const undo = undoMapEdit();
    const undoNpcEnabled = overviewConnection(store.getCurrent()).npcEnabled;
    const redo = redoMapEdit();
    // Then: rejection cannot publish unreadable data or add a history transaction.
    expect({ runner: runner.ok, accepted: accepted?.ok ?? false, publishedReloadError,
      draftUnchanged: JSON.stringify(ctx.project) === before, storeUnchanged: acceptedJson === before,
      spatialUnchanged: JSON.stringify(ctx.project.spatialAuthoring) === spatial,
      undo, undoNpcEnabled, redo, redoExact: JSON.stringify(store.getCurrent()) === acceptedJson,
    }).toEqual({ runner: false, accepted: false, publishedReloadError: null,
      draftUnchanged: true, storeUnchanged: true, spatialUnchanged: true,
      undo: false, undoNpcEnabled: true, redo: false, redoExact: true });
  });

  it("rejects event removal when the same missing-event projection error predates the write", () => {
    // Given: the transfer event is already missing; the public tool changes a sibling event.
    const connection = overviewConnection(store.getCurrent());
    const map = own(store.getCurrent().maps, connection.from.mapId);
    map.events = map.events.filter(event => event.id !== connection.id);
    const sibling = overviewConnection(store.getCurrent(), "spatial-return:");
    const before = JSON.stringify(store.getCurrent());
    const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
    // When
    const result = runTool(ctx, "remove_event", { mapId: sibling.from.mapId, eventId: sibling.id });
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(ctx.project)).toBe(before);
    expect(undoMapEdit()).toBe(false);
  });

  it.each(["spatial-enter:", "spatial-return:"])("rejects an issued invalid %s proposal at acceptance without relying on runner rejection", async prefix => {
    // Given: model an already-issued proposal from the old runner, not a foreign/tampered one.
    const connection = overviewConnection(store.getCurrent(), prefix);
    connection.name = "Manual projection name";
    const before = JSON.stringify(store.getCurrent());
    const proposed = cloneDetachedDraft(store.getCurrent());
    beginSpatialToolProposal(proposed, store.getCurrent());
    overviewConnection(proposed, prefix).npcEnabled = false;
    sealSpatialToolProposal(proposed);
    // When
    const result = await applyProposedProject(proposed, options);
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(undoMapEdit()).toBe(false);
    expect(redoMapEdit()).toBe(false);
  });

  it("accepts a genuine projection repair through the registered runner with exact undo and reloadable redo", async () => {
    // Given: retain the real compiler's valid connection as the repair input.
    const validConnection = structuredClone(overviewConnection(store.getCurrent()));
    overviewConnection(store.getCurrent()).name = "Manual projection name";
    expect(reloadError(store.getCurrent())).not.toBeNull();
    const before = JSON.stringify(store.getCurrent());
    const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
    // When
    const runner = runTool(ctx, "upsert_map_connection", { connection: validConnection });
    expect(runner.ok, runner.summary).toBe(true);
    const accepted = await applyProposedProject(ctx.project, options);
    // Then
    expect(accepted.ok).toBe(true);
    expect(overviewConnection(store.getCurrent())).toEqual(validConnection);
    expect(reloadError(store.getCurrent())).toBeNull();
    const after = JSON.stringify(store.getCurrent());
    expect(undoMapEdit()).toBe(true);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(undoMapEdit()).toBe(false);
    expect(redoMapEdit()).toBe(true);
    expect(JSON.stringify(store.getCurrent())).toBe(after);
    expect(reloadError(store.getCurrent())).toBeNull();
    expect(redoMapEdit()).toBe(false);
  });

  it("accepts an unrelated registered edit when a legacy start-position lint error already exists", async () => {
    // Given: unrelated legacy lint remains blocking without baseline subtraction.
    const project = store.getCurrent();
    const map = own(project.maps, project.startMapId);
    map.lowerTiles[project.startPos.y * map.width + project.startPos.x] = 120;
    expect(projectLint(project).some(issue => issue.severity === "error" && issue.code === "start-position")).toBe(true);
    expect(reloadError(project)).toBeNull();
    const before = JSON.stringify(project);
    const ctx = { project: cloneDetachedDraft(project) };
    // When
    const runner = runTool(ctx, "set_map_properties", { mapId: project.startMapId, name: "Unrelated edit" });
    expect(runner.ok, runner.summary).toBe(true);
    const accepted = await applyProposedProject(ctx.project, { ...options, toolNames: ["set_map_properties"] });
    // Then
    expect(accepted.ok).toBe(true);
    expect(own(store.getCurrent().maps, project.startMapId).name).toBe("Unrelated edit");
    expect(projectLint(store.getCurrent()).some(issue => issue.severity === "error" && issue.code === "start-position")).toBe(true);
    expect(reloadError(store.getCurrent())).toBeNull();
    const after = JSON.stringify(store.getCurrent());
    expect(undoMapEdit()).toBe(true);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(redoMapEdit()).toBe(true);
    expect(JSON.stringify(store.getCurrent())).toBe(after);
  });
});
