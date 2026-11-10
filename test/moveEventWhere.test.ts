import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { getTool, runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent } from "@/project/types";

// 2026-11-11 구조 재점검 3-3: 화면 검수 결함에는 칸 좌표가 없는데 move_event 는 x,y 가 필수라 모델이 «옮길 좌표를 확인하지 못했다»로 막혔다.
function person(id: string, name: string, x: number, y: number): GameEvent {
  return {
    id, name, x, y, trigger: { kind: "action" }, commands: [], placementRole: "npc",
    pages: [{ id: "p", name, conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "…" }] }],
  } as GameEvent;
}
function fixture() {
  const ctx = { project: createBlankProject() };
  const mapId = ctx.project.startMapId;
  const map = ctx.project.maps[mapId];
  assert(map);
  map.events.push(person("ev_merchant", "상인", 5, 5), person("ev_chief", "촌장", 9, 4));
  const where = () => { const e = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_merchant")!; return { x: e.x, y: e.y }; };
  return { ctx, mapId, where };
}

describe("move_event — 좌표 없이 옮기기", () => {
  it("x,y 는 필수가 아니다", () => {
    expect(getTool("move_event")?.parameters.required).toEqual(["mapId", "eventId"]);
  });

  it("dx,dy 는 지금 칸 기준이다 — «두 칸 왼쪽»", () => {
    const { ctx, mapId, where } = fixture();
    const result = runTool(ctx, "move_event", { mapId, eventId: "ev_merchant", dx: -2 });
    assert(result.ok, result.summary);
    expect(where()).toEqual({ x: 3, y: 5 });
    expect(result.data).toMatchObject({ x: 3, y: 5, from: { x: 5, y: 5 } });
  });

  it("where 는 자리 낱말로 칸을 고르고 고른 칸을 돌려준다 — 다른 이벤트 이름도 기준이 된다", () => {
    const { ctx, mapId, where } = fixture();
    const result = runTool(ctx, "move_event", { mapId, eventId: "ev_merchant", where: "촌장 옆" });
    assert(result.ok, result.summary);
    const at = where();
    expect(Math.abs(at.x - 9) + Math.abs(at.y - 4)).toBeLessThanOrEqual(2);
    expect(at).not.toEqual({ x: 9, y: 4 });
    expect(result.data).toMatchObject({ x: at.x, y: at.y, how: expect.stringContaining("촌장") });
  });

  it("그 맵에 없는 자리 낱말은 옮기지 않고 거절한다(시작 근처로 보내지 않는다)", () => {
    const { ctx, mapId, where } = fixture();
    const result = runTool(ctx, "move_event", { mapId, eventId: "ev_merchant", where: "용의 둥지 옆" });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("Nothing was moved");
    expect(where()).toEqual({ x: 5, y: 5 });
  });

  it("목적지가 없으면 세 가지 방법을 일러 준다", () => {
    const { ctx, mapId, where } = fixture();
    const result = runTool(ctx, "move_event", { mapId, eventId: "ev_merchant" });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/dx and dy/u);
    expect(result.summary).toMatch(/where/u);
    expect(where()).toEqual({ x: 5, y: 5 });
  });
});
