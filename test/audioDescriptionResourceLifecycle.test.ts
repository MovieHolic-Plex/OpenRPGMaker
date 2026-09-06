import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { audioDescriptionToolProject, MUSIC_ID, SOUND_ID } from "./support/audioDescriptionToolProject";

describe("uploaded resource description lifecycle", () => {
  it("removes an imported audio profile when its asset is deleted", () => {
    const project = audioDescriptionToolProject();
    project.resourceProfiles.push({ kind: "music", name: "Imported", assetId: MUSIC_ID });
    const ctx: ToolContext = { project };

    const result = runTool(ctx, "delete_resource", { resourceId: MUSIC_ID });

    expect(result.ok).toBe(true);
    expect(ctx.project.resourceProfiles.some(profile => profile.assetId === MUSIC_ID)).toBe(false);
    expect(runTool(ctx, "get_audio_resource", { kind: "music", resourceId: MUSIC_ID }).ok).toBe(false);
  });

  it("retains a referenced imported audio asset and its profile", () => {
    const project = audioDescriptionToolProject();
    project.resourceProfiles.push({ kind: "music", name: "Imported", assetId: MUSIC_ID });
    project.system.defaultBgmResourceId = MUSIC_ID;
    const before = structuredClone(project);
    const ctx: ToolContext = { project };

    const result = runTool(ctx, "delete_resource", { resourceId: MUSIC_ID });

    expect(result.ok).toBe(false);
    expect(ctx.project).toEqual(before);
  });

  it.each(["music", "sound"] as const)("writes a description when upserting new %s", (kind) => {
    // Given
    const ctx: ToolContext = { project: audioDescriptionToolProject() };
    // When
    const result = runTool(ctx, "upsert_resource", {
      resource: { id: "qa-new-audio", name: "New audio", kind, description: "  sentinel\nline  " },
    });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
    expect(ctx.project.audioDescriptions).toEqual({ [kind]: { "qa-new-audio": "sentinel\nline" } });
    expect(ctx.project.assets.uploaded["qa-new-audio"]?.meta).toEqual({});
    expect(runTool(ctx, "get_audio_resource", { kind, resourceId: "qa-new-audio" }).data)
      .toMatchObject({ resource: { description: "sentinel\nline", descriptionSource: "project" } });
  });

  it("preserves the description when upsert omits it", () => {
    // Given
    const project = audioDescriptionToolProject();
    project.audioDescriptions = { music: { [MUSIC_ID]: "" }, sound: { [SOUND_ID]: "sibling" } };
    const ctx: ToolContext = { project };
    // When
    const result = runTool(ctx, "upsert_resource", {
      resource: { id: MUSIC_ID, name: "Renamed", kind: "music" },
    });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff).toMatchObject({ audioDescriptionsChanged: 0 });
    expect(ctx.project.audioDescriptions).toEqual(project.audioDescriptions);
    expect(ctx.project.assets.uploaded[MUSIC_ID]?.dataUrl).toBe(project.assets.uploaded[MUSIC_ID]?.dataUrl);
  });

  it("retains an explicit clear when upsert supplies an empty description", () => {
    // Given
    const project = audioDescriptionToolProject();
    project.audioDescriptions = { music: { [MUSIC_ID]: "old" } };
    const ctx: ToolContext = { project };
    // When
    const result = runTool(ctx, "upsert_resource", {
      resource: { id: MUSIC_ID, name: "Audio", kind: "music", description: "" },
    });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.audioDescriptions).toEqual({ music: { [MUSIC_ID]: "" } });
  });

  it.each([undefined, null, 1, false, [], {}, "x".repeat(4001)])(
    "rejects invalid nested descriptions before changing an upload when given %j", (description) => {
      // Given
      const project = audioDescriptionToolProject();
      const before = structuredClone(project);
      const ctx: ToolContext = { project };
      // When
      const result = runTool(ctx, "upsert_resource", {
        resource: { id: MUSIC_ID, name: "Changed", kind: "music", description },
      });
      // Then
      expect(result.ok).toBe(false);
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
      expect(ctx.project).toBe(project);
      expect(project).toEqual(before);
    },
  );

  it("rejects descriptions on non-audio resources", () => {
    // Given
    const project = audioDescriptionToolProject();
    const before = structuredClone(project);
    const ctx: ToolContext = { project };
    // When
    const result = runTool(ctx, "upsert_resource", {
      resource: { id: "qa-picture", name: "Picture", kind: "picture", description: "" },
    });
    // Then
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
    expect(project).toEqual(before);
    expect(ctx.project).toBe(project);
  });

  it("removes only the deleted upload's kind and ID override when deletion succeeds", () => {
    // Given
    const project = audioDescriptionToolProject();
    project.audioDescriptions = {
      music: { [MUSIC_ID]: "" },
      sound: { [MUSIC_ID]: "other partition", [SOUND_ID]: "other resource" },
    };
    const ctx: ToolContext = { project };
    // When
    const result = runTool(ctx, "delete_resource", { resourceId: MUSIC_ID });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
    expect(ctx.project.assets.uploaded[MUSIC_ID]).toBeUndefined();
    expect(ctx.project.audioDescriptions).toEqual({
      sound: { [MUSIC_ID]: "other partition", [SOUND_ID]: "other resource" },
    });
  });

  it("preserves the description when a referenced upload cannot be deleted", () => {
    // Given
    const project = audioDescriptionToolProject();
    project.system.defaultBgmResourceId = MUSIC_ID;
    project.audioDescriptions = { music: { [MUSIC_ID]: "preserved" } };
    const before = structuredClone(project);
    const ctx: ToolContext = { project };
    // When
    const result = runTool(ctx, "delete_resource", { resourceId: MUSIC_ID });
    // Then
    expect(result.ok).toBe(false);
    expect(ctx.project).toBe(project);
    expect(project).toEqual(before);
  });
});
