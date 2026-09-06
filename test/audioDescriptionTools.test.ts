import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { audioDescriptionToolProject, MUSIC_ID, SOUND_ID } from "./support/audioDescriptionToolProject";

describe("audio description tools", () => {
  it.each([
    ["music", MUSIC_ID],
    ["sound", SOUND_ID],
  ] as const)("returns the complete %s description when an override exists", (kind, resourceId) => {
    // Given
    const project = audioDescriptionToolProject();
    const description = `sentinel "\n${"x".repeat(3970)}`;
    project.audioDescriptions = { [kind]: { [resourceId]: description } };
    const before = structuredClone(project);
    // When
    const result = runTool({ project }, "get_audio_resource", { kind, resourceId });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({
      resource: { id: resourceId, kind, description, descriptionSource: "project" },
    });
    expect(project).toEqual(before);
  });

  it.each(["", "  sentinel\nsecond line  ", "x".repeat(4000)])(
    "stores normalized input when set receives %j", (description) => {
      // Given
      const project = audioDescriptionToolProject();
      project.audioDescriptions = { sound: { [SOUND_ID]: "sibling" } };
      const before = structuredClone(project);
      const ctx: ToolContext = { project };
      // When
      const result = runTool(ctx, "set_audio_description", {
        kind: "music", resourceId: MUSIC_ID, action: "set", description,
      });
      // Then
      expect(result.ok, result.summary).toBe(true);
      expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
      expect(ctx.project.audioDescriptions).toEqual({
        music: { [MUSIC_ID]: description.trim() }, sound: { [SOUND_ID]: "sibling" },
      });
      expect(project).toEqual(before);
      expect(runTool(ctx, "get_audio_resource", { kind: "music", resourceId: MUSIC_ID }).data)
        .toMatchObject({ resource: { description: description.trim(), descriptionSource: "project" } });
    },
  );

  it("restores inheritance when reset removes an explicit clear", () => {
    // Given
    const project = audioDescriptionToolProject();
    project.audioDescriptions = {
      music: { [MUSIC_ID]: "" },
      sound: { [MUSIC_ID]: "other partition", [SOUND_ID]: "other ID" },
    };
    const ctx: ToolContext = { project };
    // When
    const result = runTool(ctx, "set_audio_description", {
      kind: "music", resourceId: MUSIC_ID, action: "reset",
    });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
    expect(ctx.project.audioDescriptions).toEqual({
      sound: { [MUSIC_ID]: "other partition", [SOUND_ID]: "other ID" },
    });
    expect(runTool(ctx, "get_audio_resource", { kind: "music", resourceId: MUSIC_ID }).data)
      .toMatchObject({ resource: { description: "", descriptionSource: "missing" } });
  });

  it("reports no change when resetting an inherited description", () => {
    // Given
    const ctx: ToolContext = { project: audioDescriptionToolProject() };
    // When
    const result = runTool(ctx, "set_audio_description", {
      kind: "music", resourceId: MUSIC_ID, action: "reset",
    });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff).toMatchObject({ audioDescriptionsChanged: 0 });
    expect(Object.hasOwn(ctx.project, "audioDescriptions")).toBe(false);
  });

  it.each(["get_audio_resource", "set_audio_description"])(
    "rejects invalid identities without mutation when calling %s", (name) => {
      // Given
      const cases = [
        { kind: "picture", resourceId: MUSIC_ID, code: "invalid-args" },
        { kind: "BGM", resourceId: MUSIC_ID, code: "invalid-args" },
        { kind: "music", resourceId: "", code: "invalid-args" },
        { kind: "music", resourceId: ` ${MUSIC_ID}`, code: "invalid-args" },
        { kind: "music", resourceId: `bgm:${MUSIC_ID}`, code: "invalid-args" },
        { kind: "sound", resourceId: `se:${SOUND_ID}`, code: "invalid-args" },
        { kind: "music", resourceId: 42, code: "invalid-args" },
        { kind: "music", resourceId: "missing-audio", code: "resource-not-found" },
        { kind: "music", resourceId: SOUND_ID, code: "resource-not-found" },
        { kind: "sound", resourceId: MUSIC_ID, code: "resource-not-found" },
      ];
      for (const { kind, resourceId, code } of cases) {
        const project = audioDescriptionToolProject();
        const before = structuredClone(project);
        const ctx: ToolContext = { project };
        const args = name === "set_audio_description"
          ? { kind, resourceId, action: "set", description: "sentinel" }
          : { kind, resourceId };
        // When
        const result = runTool(ctx, name, args);
        // Then
        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
        expect(ctx.project).toBe(project);
        expect(project).toEqual(before);
      }
    },
  );

  it.each([
    { action: "set" },
    { action: "set", description: undefined },
    { action: "set", description: null },
    { action: "set", description: 1 },
    { action: "set", description: [] },
    { action: "set", description: {} },
    { action: "set", description: "x".repeat(4001) },
    { action: "reset", description: "" },
    { action: "reset", description: undefined },
    { action: "clear", description: "" },
  ])("rejects invalid action input without mutation when given %j", (input) => {
    // Given
    const project = audioDescriptionToolProject();
    project.audioDescriptions = { music: { [MUSIC_ID]: "preserved" } };
    const before = structuredClone(project);
    const ctx: ToolContext = { project };
    // When
    const result = runTool(ctx, "set_audio_description", {
      kind: "music", resourceId: MUSIC_ID, ...input,
    });
    // Then
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
    expect(ctx.project).toBe(project);
    expect(project).toEqual(before);
  });

  it("reads the current project when the caller switches projects", () => {
    // Given
    const first = audioDescriptionToolProject();
    first.audioDescriptions = { music: { [MUSIC_ID]: "first" } };
    const second = audioDescriptionToolProject();
    second.audioDescriptions = { music: { [MUSIC_ID]: "second" } };
    const ctx: ToolContext = { project: first };
    expect(runTool(ctx, "get_audio_resource", { kind: "music", resourceId: MUSIC_ID }).ok).toBe(true);
    ctx.project = second;
    // When
    const result = runTool(ctx, "get_audio_resource", { kind: "music", resourceId: MUSIC_ID });
    // Then
    expect(result.data).toMatchObject({ resource: { description: "second", descriptionSource: "project" } });
  });
});
