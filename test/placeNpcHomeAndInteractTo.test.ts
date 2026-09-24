import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { runTool } from "@/editor/tools";
import { splitInteractWalkSteps } from "@/editor/tools/playTools";

// 2026-09-24 JRPG 도그푸딩 ember-4: 상점 NPC 넷이 make_villager 모양(home:{x,y})으로 place_npc 를 불러 전부
// 「x,y is required」로 거부됐고, 합류·엔딩 검증 run_scene_test 셋이 interact 스텝에 to/adjacent 를 써 거부됐다.
describe("place_npc home:{x,y} · run_scene_test interact to", () => {
  it("place_npc 는 x,y 대신 home:{x,y} 를 받는다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const result = runTool(ctx, "place_npc", { mapId, name: "도구상인 홉스", home: { x: 6, y: 6 }, pages: [{ lines: ["어서 오세요."] }] });
    expect(result.ok, result.summary).toBe(true);
    const npc = ctx.project.maps[mapId]!.events.find((event) => event.name === "도구상인 홉스")!;
    expect(Math.abs(npc.x - 6) + Math.abs(npc.y - 6)).toBeLessThanOrEqual(2);
  });

  it("좌표가 전혀 없으면 x,y 또는 home 을 짚어 거부한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "무명", pages: [{ lines: ["…"] }] });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/home/u);
  });

  it("interact 의 to/adjacent 는 walk + interact 로 나뉜다", () => {
    const { input, split } = splitInteractWalkSteps({
      mapId: "m", start: { x: 1, y: 1 },
      steps: [{ kind: "interact", adjacent: true, to: { x: 8, y: 6 } }, { kind: "choose", index: 0 }],
    });
    expect(split).toEqual([0]);
    expect((input as { steps: unknown[] }).steps).toEqual([
      { kind: "walk", to: { x: 8, y: 6 }, adjacent: true },
      { kind: "interact" },
      { kind: "choose", index: 0 },
    ]);
  });

  it("다른 틀린 필드가 섞이거나 to 가 좌표가 아니면 그대로 둔다", () => {
    const steps = [{ kind: "interact", to: "ev_npc" }, { kind: "walk", to: { x: 1, y: 1 } }];
    expect(splitInteractWalkSteps({ steps }).split).toEqual([]);
  });

  it("run_scene_test 가 나눈 스텝으로 NPC 를 조사한다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const placed = runTool(ctx, "place_npc", { mapId, name: "촌장", x: 8, y: 6, pages: [{ lines: ["왔구나."] }] });
    expect(placed.ok, placed.summary).toBe(true);
    const npc = ctx.project.maps[mapId]!.events.find((event) => event.name === "촌장")!;
    const result = runTool(ctx, "run_scene_test", {
      mapId, start: { x: npc.x, y: npc.y + 2 },
      steps: [{ kind: "interact", adjacent: true, to: { x: npc.x, y: npc.y } }, { kind: "expect", interactionComplete: true }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.warnings?.join(" ")).toMatch(/walk/u);
  });
});
