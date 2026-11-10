import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { blueprintOpeningReplaceable } from "@/editor/tools/blueprintOpening";
import { createBlankProject } from "@/project/defaults";

// 2026-11-11 구조 재점검 3-2: 모델이 author_opening_stage 로 무대를 지어도 끝맺음이 깐 맵 조각 장면(bp-open-*)이 앞에 남아
// 화면 검수가 계속 그 장면만 봤고, 그림 장면을 지우면 끝맺음이 다시 깔았다.
function fixture() {
  const ctx = { project: createBlankProject() };
  const scene = (id: string) => ({ id, kind: "text", text: id, durationMs: 1000 });
  ctx.project.system.opening = { enabled: true, skippable: true, scenes: [scene("bp-open-1"), scene("bp-open-2"), scene("my-title-card")] } as never;
  return ctx;
}
const BEATS = [{ kind: "wait", ms: 300 }];

describe("author_opening_stage — 끝맺음이 깐 기본 장면을 대신한다", () => {
  it("bp-open-* 장면을 걷고 모델이 지은 장면은 남긴다", () => {
    const ctx = fixture();
    const result = runTool(ctx, "author_opening_stage", { mapId: ctx.project.startMapId, x: ctx.project.startPos.x, y: ctx.project.startPos.y, beats: BEATS });
    assert(result.ok, result.summary);
    expect(ctx.project.system.opening?.scenes.map((s) => s.id)).toEqual(["my-title-card"]);
    expect(result.data).toMatchObject({ replacedDefaultScenes: 2, pictureScenes: 1 });
  });

  it("칸을 안 주면 도구가 고른다 — 시작 맵은 시작 위치", () => {
    const ctx = fixture();
    const result = runTool(ctx, "author_opening_stage", { mapId: ctx.project.startMapId, beats: BEATS });
    assert(result.ok, result.summary);
    expect(ctx.project.system.opening?.stage).toMatchObject({ mapId: ctx.project.startMapId, x: ctx.project.startPos.x, y: ctx.project.startPos.y });
  });

  it("무대가 있으면 끝맺음은 맵 조각 오프닝을 다시 깔지 않는다(그림 장면이 0개여도)", () => {
    const ctx = fixture();
    ctx.project.system.opening!.scenes.splice(2, 1);
    expect(blueprintOpeningReplaceable(ctx.project).replace).toBe(true);
    const result = runTool(ctx, "author_opening_stage", { mapId: ctx.project.startMapId, beats: BEATS });
    assert(result.ok, result.summary);
    expect(ctx.project.system.opening?.scenes).toHaveLength(0);
    expect(blueprintOpeningReplaceable(ctx.project).replace).toBe(false);
  });
});
