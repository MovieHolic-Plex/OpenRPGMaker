import { describe, expect, it } from "vitest";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { PiCharsetSelectionGate } from "@/ai/piAgent/charsetSelectionGate";
import { buildFixture, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import type { ToolContext } from "@/editor/tools/types";

/**
 * 조수 경로(createPiToolset + 칩 관문)에서만 보이는 거절 — runTool 만 부르는 시험에는 안 잡힌다.
 * 2026-11-12 셋째 묶음 Terra «후»(#4630 머리): 장치 도구가 닿자 그다음 겹이 드러났다.
 */
function session(fixture: FixtureId, extra: Partial<ToolContext> = {}) {
  const ctx = { project: buildFixture(fixture), assistantRun: true, ...extra } as ToolContext;
  const tools = createPiToolset(ctx, { charsetGate: new PiCharsetSelectionGate() });
  const call = async (name: string, args: Record<string, unknown>) => {
    const out = await tools.find((tool) => tool.name === name)!.execute("call", args) as { content: Array<{ text: string }> };
    return JSON.parse(out.content[0]!.text) as { ok: boolean; summary: string; warnings?: string[]; data?: { rect?: { x: number; y: number; width: number; height: number } } };
  };
  return { ctx, call };
}

describe("칩 관문 — 도구·잠금이 스스로 고른 칩은 모델의 선택이 아니다", () => {
  it("configure_monster_system: 잠금이 출연진 칩을 갈아 끼워도 되돌리지 않는다", async () => {
    const { ctx, call } = session("blank", { monsterTurn: true });
    const hero = ctx.project.database.actors[0]!.characterResourceId;
    const result = await call("configure_monster_system", { enabled: true, capture: true });
    expect(result.ok).toBe(true);
    expect(ctx.project.system.monsterCollection).toBe(true);
    // 잠금이 실제로 칩을 바꿨어야 이 시험이 관문을 지나간 것이다.
    expect(ctx.project.database.actors[0]!.characterResourceId).not.toBe(hero);
  });

  it("place_trainer: 빈 프로젝트의 첫 호출(잠금이 걸리는 호출)에서 트레이너가 선다", async () => {
    const { ctx, call } = session("blank", { monsterTurn: true });
    const result = await call("place_trainer", { mapId: "map_blank_start", x: 6, y: 5, name: "트레이너", troopId: "troop_slime", facing: "right", sightRange: 4, before: "눈이 마주쳤네!", after: "멋진 배틀이었어!" });
    expect(result.ok).toBe(true);
    expect(ctx.project.system.genreLock?.preset).toBe("monster-collect");
    expect(Object.values(ctx.project.maps)[0]!.events.some((event) => event.id.startsWith("ev_trainer_"))).toBe(true);
  });

  it("place_storage_chest: 그림 인자가 없는 도구가 고른 상자 칩은 첫 호출에 선다", async () => {
    const { ctx, call } = session("starter");
    const result = await call("place_storage_chest", { mapId: "map_ember_village", x: 9, y: 12 });
    expect(result.ok).toBe(true);
    expect(ctx.project.maps.map_ember_village!.events.some((event) => event.id.startsWith("ev_storage_chest_"))).toBe(true);
  });

  it("모델이 직접 적은 안 본 칩은 여전히 되돌린다(관문은 풀지 않았다)", async () => {
    const { call } = session("starter");
    const page = { id: "ev_unseen_p0", conditions: [], graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down", pattern: 79 }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] };
    await expect(call("upsert_event", { mapId: "map_ember_village", event: { id: "ev_unseen", name: "상자", x: 9, y: 12, pages: [page] } }))
      .rejects.toThrow(/list_npc_graphics/u);
  });
});

describe("stamp_object — 사람이 선 칸", () => {
  const args = { objectId: "kit:beodeul_city/bd-pick-fishing-port-lobster-pots", mapId: "map_ember_village", layers: "both" };
  const child = (ctx: ToolContext) => ctx.project.maps.map_ember_village!.events.find((event) => event.id === "ev_ember_child")!;
  const covers = (rect: { x: number; y: number; width: number; height: number }, at: { x: number; y: number }) =>
    at.x >= rect.x && at.x < rect.x + rect.width && at.y >= rect.y && at.y < rect.y + rect.height;

  it("nearest 는 사람을 비켜 찍고 그 사람을 옮기지 않는다", async () => {
    const { ctx, call } = session("starter");
    const at = { x: child(ctx).x, y: child(ctx).y };
    const result = await call("stamp_object", { ...args, ...at, onOverlap: "nearest" });
    expect(result.ok).toBe(true);
    expect(covers(result.data!.rect!, at)).toBe(false);
    expect({ x: child(ctx).x, y: child(ctx).y }).toEqual(at);
    expect(result.warnings?.join(" ")).toMatch(/was not moved/u);
  });

  it("기본(refuse)은 전과 같다 — 그 자리에 찍고 경고한다", async () => {
    const { ctx, call } = session("starter");
    const at = { x: child(ctx).x, y: child(ctx).y };
    const result = await call("stamp_object", { ...args, ...at });
    expect(result.ok).toBe(true);
    expect(covers(result.data!.rect!, at)).toBe(true);
  });
});
