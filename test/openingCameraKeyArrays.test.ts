// 2026-11-05 gpt-only-game (Terra alone, 「학교 배경 연애 게임」): animate_opening_camera got camera.x as a keyframe
// array and was refused three times ("camera.x: -20000..20000 number required"), so the opening lost its camera move.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools/types";

function shotCamera(ctx: ToolContext): unknown {
  let found: unknown;
  JSON.stringify(ctx.project, (key, value) => {
    if (value && typeof value === "object" && (value as { id?: unknown }).id === "s1" && (value as { kind?: unknown }).kind === "animatic") {
      found = (value as { composition?: { camera?: unknown } }).composition?.camera;
    }
    return value;
  });
  return found;
}

describe("animate_opening_camera keyframe arrays", () => {
  it("camera.x as [{atMs,value}] becomes keys.x with the first value as the start", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    expect(runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false }).ok).toBe(true);
    const result = runTool(ctx, "animate_opening_camera", { shotId: "s1", camera: { x: [{ atMs: 0, value: 0 }, { atMs: 6500, value: 8 }] } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(shotCamera(ctx)).toMatchObject({ x: 0, keys: { x: [{ atMs: 0, value: 0 }, { atMs: 6500, value: 8 }] } });
  });

  // 2026-11-05 cat exploration: keys sent as one frame per time ([{atMs,x,y,zoom}]) was refused "camera.keys.0: unsupported field".
  it("camera.keys as per-time frames becomes per-property tracks", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false });
    const result = runTool(ctx, "animate_opening_camera", { shotId: "s1", camera: { keys: [{ atMs: 0, x: 0, y: 0, zoom: 1 }, { atMs: 6500, x: 4, y: 0, zoom: 1.04 }] } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(shotCamera(ctx)).toMatchObject({ x: 0, zoom: 1, keys: { x: [{ atMs: 0, value: 0 }, { atMs: 6500, value: 4 }], zoom: [{ atMs: 0, value: 1 }, { atMs: 6500, value: 1.04 }] } });
  });

  // 2026-11-05 cat exploration: six new shots landed behind the four factory kingdom scenes, so New Game still opened on them.
  it("the first animatic shot clears the untouched factory opening scenes", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    expect(ctx.project.system.opening?.scenes.some((s) => s.kind === "image")).toBe(true);
    runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false });
    expect(ctx.project.system.opening?.scenes.map((s) => s.id)).toEqual(["s1"]);
  });

  it("an authored image scene is kept when the first animatic shot is added", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    ctx.project.system.opening!.scenes = [{ id: "mine", kind: "image", resourceId: "oprn-still-harbor", narration: "항구의 아침", durationMs: 4000 }];
    runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false });
    expect(ctx.project.system.opening?.scenes.map((s) => s.id)).toEqual(["mine", "s1"]);
  });

  it("a non-keyframe array is still refused", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false });
    expect(runTool(ctx, "animate_opening_camera", { shotId: "s1", camera: { x: [1, 2] } }, { dryRun: false }).ok).toBe(false);
  });
});
