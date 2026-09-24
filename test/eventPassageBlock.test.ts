// 한 칸 문간에 세운 막는 이벤트가 너머의 이벤트를 끊으면 upsert_event·place_npc 가 경고한다(거부 아님).
// 2026-09-24 갤러리 호러 r5: 출구 회랑 문간의 가면 인형이 출구 그림과 두 엔딩을 막았다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { eventsCutOffBy } from "@/project/eventPassageBlock";
import type { Project } from "@/project/types";

function twoRooms(): { ctx: { project: Project }; mapId: string; door: { x: number; y: number } } {
  const ctx: { project: Project } = { project: createBlankProject() };
  const mapId = ctx.project.startMapId;
  const map = ctx.project.maps[mapId]!;
  const { x: sx, y: sy } = ctx.project.startPos;
  const wallX = sx + 2;
  for (let y = 0; y < map.height; y += 1) if (y !== sy) map.lowerTiles[y * map.width + wallX] = -1;
  return { ctx, mapId, door: { x: wallX, y: sy } };
}

const warningsOf = (result: unknown): string => JSON.stringify(result);

describe("passage-blocking event warning", () => {
  it("warns when an NPC in the one-tile doorway cuts off the event behind it", () => {
    const { ctx, mapId, door } = twoRooms();
    const painting = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_exit", name: "출구 그림", x: door.x + 2, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "그림." }] }] } });
    expect(painting.ok, painting.summary).toBe(true);
    expect(warningsOf(painting)).not.toContain("통로를 막아");
    const doll = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_doll", name: "가면 인형", x: door.x, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], priority: "same", commands: [{ kind: "text", body: "..." }] }] } });
    expect(doll.ok, doll.summary).toBe(true);
    expect(warningsOf(doll)).toContain("통로를 막아");
    expect(warningsOf(doll)).toContain("출구 그림");
  });

  it("stays quiet when the NPC stands beside the doorway or steps aside on a later page", () => {
    const { ctx, mapId, door } = twoRooms();
    runTool(ctx, "upsert_event", { mapId, event: { id: "ev_exit", name: "출구 그림", x: door.x + 2, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [] }] } });
    const beside = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_doll", x: door.x - 1, y: door.y - 1, pages: [{ trigger: { kind: "action" }, conditions: [], priority: "same", commands: [] }] } });
    expect(warningsOf(beside)).not.toContain("통로를 막아");
    const map = ctx.project.maps[mapId]!;
    const stepsAside = { id: "ev_doll2", x: door.x, y: door.y, pages: [
      { trigger: { kind: "action" }, conditions: [], priority: "same", commands: [] },
      { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_talked", value: true }], priority: "below", commands: [] },
    ] } as unknown as Parameters<typeof eventsCutOffBy>[2];
    expect(eventsCutOffBy(ctx.project, map, stepsAside)).toEqual([]);
  });
});
