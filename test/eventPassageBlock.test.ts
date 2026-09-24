// 한 칸 문간에 세운 막는 이벤트가 너머를 끊으면, 문이 아닌 이벤트는 옆 칸으로 옮긴다.
// 2026-09-24 갤러리 호러 r5: 출구 회랑 문간의 가면 인형이 출구 그림과 두 엔딩을 막았다. 경고만으로는 안 옮겨졌다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { eventsCutOffBy } from "@/project/eventPassageBlock";
import { runGameCheck } from "@/qa/gameCheck";
import { buildMapGraph, checkMapGraph } from "@/qa/gameCheck/mapGraph";
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
  it("moves a non-door NPC off the one-tile doorway", () => {
    const { ctx, mapId, door } = twoRooms();
    const painting = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_exit", name: "출구 그림", x: door.x + 2, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "그림." }] }] } });
    expect(painting.ok, painting.summary).toBe(true);
    expect(warningsOf(painting)).not.toContain("통로를 막아");
    const doll = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_doll", name: "가면 인형", x: door.x, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], priority: "same", commands: [{ kind: "text", body: "..." }] }] } });
    expect(doll.ok, doll.summary).toBe(true);
    expect(warningsOf(doll)).toContain("통로를 막아");
    expect(warningsOf(doll)).toContain("옮겼습니다");
    expect(warningsOf(doll)).toContain("출구 그림");
    const map = ctx.project.maps[mapId]!;
    const placed = map.events.find((event) => event.id === "ev_doll")!;
    expect(placed.x === door.x && placed.y === door.y).toBe(false);
    expect(eventsCutOffBy(ctx.project, map, placed)).toEqual([]);
  });

  it("leaves a transfer door in the doorway and only warns", () => {
    const { ctx, mapId, door } = twoRooms();
    runTool(ctx, "upsert_event", { mapId, event: { id: "ev_exit", name: "출구 그림", x: door.x + 2, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "그림." }] }] } });
    const gate = runTool(ctx, "upsert_event", {
      mapId,
      event: {
        id: "ev_door", name: "잠긴 문", x: door.x, y: door.y,
        pages: [{ trigger: { kind: "action" }, conditions: [], priority: "same", graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 1 }, commands: [{ kind: "transfer", mapId, x: door.x - 2, y: door.y }] }],
      },
    });
    expect(gate.ok, gate.summary).toBe(true);
    const placed = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_door")!;
    expect(placed.x).toBe(door.x);
    expect(placed.y).toBe(door.y);
    expect(warningsOf(gate)).toContain("통로를 막아");
    expect(warningsOf(gate)).not.toContain("옮겼습니다");
  });

  it("does not count the leftover blank seed map as a blocker once start has moved", () => {
    const project = createBlankProject();
    const seed = project.maps[project.startMapId]!;
    project.maps.map_gallery = { ...seed, id: "map_gallery", name: "푸른 회랑", events: [] };
    project.startMapId = "map_gallery";
    const findings = checkMapGraph(project, buildMapGraph(project));
    const orphan = findings.find((finding) => finding.code === "orphan-empty-map" && finding.where?.mapId === "map_blank_start");
    expect(orphan?.severity).toBe("warning");
    expect(findings.some((finding) => finding.severity === "blocker" && finding.code === "orphan-empty-map")).toBe(false);
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

describe("fork else ending", () => {
  it("turns on the switch a false-condition fork is avoiding before the else ending", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const { x, y } = ctx.project.startPos;
    ctx.project.endings = [{ id: "ending_lonely", name: "쓸쓸", priority: 1, conditions: [] }];
    const setter = runTool(ctx, "upsert_event", {
      mapId,
      event: {
        id: "ev_doll", name: "가면 인형", x: x + 1, y,
        pages: [{
          trigger: { kind: "action" }, conditions: [], priority: "same",
          commands: [{ kind: "text", body: "장미를 내놔." }, { kind: "setSwitch", switchId: "sw_gave", value: true }],
        }],
      },
    });
    expect(setter.ok, setter.summary).toBe(true);
    const exit = runTool(ctx, "upsert_event", {
      mapId,
      event: {
        id: "ev_exit", name: "출구 그림", x, y: y + 1,
        pages: [{
          trigger: { kind: "action" }, conditions: [], priority: "same",
          commands: [{
            kind: "fork",
            condition: { kind: "switch", switchId: "sw_gave", value: false },
            then: [{ kind: "text", body: "함께 나간다." }],
            else: [{ kind: "triggerEnding", endingId: "ending_lonely" }],
          }],
        }],
      },
    });
    expect(exit.ok, exit.summary).toBe(true);
    const report = runGameCheck(ctx.project, { autoPlayBudgetMs: 20_000 });
    const run = report.autoPlay?.runs.find((entry) => entry.label === "기본 경로");
    expect(run?.ok, run?.failure?.detail).toBe(true);
    expect(run?.endingReached).toBe("ending_lonely");
  });
});
