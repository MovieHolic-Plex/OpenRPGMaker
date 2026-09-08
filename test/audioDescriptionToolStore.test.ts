import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryEntries, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { applyProposedProject, captureProposalBase, applyToolSequenceToStore, applyToolToStore, previewTool } from "@/editor/tools/applyChangesetToStore";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { store } from "@/project/store";
import { audioDescriptionToolProject, MUSIC_ID } from "./support/audioDescriptionToolProject";

const SET_ARGS = {
  kind: "music", resourceId: MUSIC_ID, action: "set", description: "accepted sentinel",
} as const;

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(audioDescriptionToolProject());
  resetMapEditHistory();
});

afterEach(() => {
  resetMapEditHistory();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("audio description store adapter", () => {
  it("leaves the live project and history unchanged when a preview is discarded", () => {
    // Given
    const before = structuredClone(store.getCurrent());
    // When
    const result = previewTool("set_audio_description", SET_ARGS);
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it("applies only the description when a detached proposal is accepted", async () => {
    // Given
    const before = structuredClone(store.getCurrent());
    const ctx: ToolContext = { project: store.getCurrent() };
    const base = captureProposalBase(ctx.project);
    const preview = runTool(ctx, "set_audio_description", SET_ARGS);
    expect(preview.ok, preview.summary).toBe(true);
    expect(store.getCurrent()).toEqual(before);
    // When
    const applied = await applyProposedProject(ctx.project, {
      base,
      baseline: new AuthoredProjectBaseline(before),
      source: "agent", agentName: "test-agent", summary: "fixture",
      toolNames: ["set_audio_description"],
    });
    // Then
    expect(applied.ok).toBe(true);
    expect(store.getCurrent()).toEqual({
      ...before, audioDescriptions: { music: { [MUSIC_ID]: SET_ARGS.description } },
    });
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(runTool({ project: store.getCurrent() }, "get_audio_resource", {
      kind: "music", resourceId: MUSIC_ID,
    }).data).toMatchObject({ resource: { description: SET_ARGS.description, descriptionSource: "project" } });
  });

  it("restores the previous clear when an accepted edit is undone", () => {
    // Given
    const before = audioDescriptionToolProject();
    before.audioDescriptions = { music: { [MUSIC_ID]: "" } };
    store.replace(before);
    expect(applyToolToStore("set_audio_description", SET_ARGS).ok).toBe(true);
    // When
    const undone = undoMapEdit();
    // Then
    expect(undone).toBe(true);
    expect(store.getCurrent()).toEqual(before);
  });

  it("restores the accepted description when an undone edit is redone", () => {
    // Given
    expect(applyToolToStore("set_audio_description", SET_ARGS).ok).toBe(true);
    const accepted = structuredClone(store.getCurrent());
    expect(undoMapEdit()).toBe(true);
    // When
    const redone = redoMapEdit();
    // Then
    expect(redone).toBe(true);
    expect(store.getCurrent()).toEqual(accepted);
  });

  it("restores the override when reset is undone", () => {
    // Given
    const before = audioDescriptionToolProject();
    before.audioDescriptions = { music: { [MUSIC_ID]: "before reset" } };
    store.replace(before);
    expect(applyToolToStore("set_audio_description", {
      kind: "music", resourceId: MUSIC_ID, action: "reset",
    }).ok).toBe(true);
    expect(Object.hasOwn(store.getCurrent(), "audioDescriptions")).toBe(false);
    // When
    const undone = undoMapEdit();
    // Then
    expect(undone).toBe(true);
    expect(store.getCurrent()).toEqual(before);
  });

  it("rejects the entire sequence when a later description edit is invalid", () => {
    // Given
    const before = structuredClone(store.getCurrent());
    // When
    const results = applyToolSequenceToStore([
      { name: "set_audio_description", args: SET_ARGS },
      { name: "set_audio_description", args: { ...SET_ARGS, resourceId: "missing-audio" } },
    ]);
    // Then
    expect(results.map(result => result.ok)).toEqual([true, false]);
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
});
