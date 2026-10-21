// create_transfer_pair 는 트리거를 문 그림 칸 그 칸에 둔다(문앞 보도 발동 금지) — 조수의 도구가 scene-* 경고를 스스로 만들지 않는다.
// 막힌 문 칸이면 부딪힘(priority same)이고, event-unreachable 도 이웃에서 부딪혀 닿는 문은 닿는 것으로 본다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { projectLint as lintProject } from "@/project/lint/projectLint";
import { lintScenePolish } from "@/project/lint/scenePolishLint";
import type { GameMap, Project } from "@/project/types";

function setup(): { project: Project; out: GameMap; inn: GameMap; door: number } {
  const project = createBlankProject();
  const out = Object.values(project.maps)[0]!;
  const tileset = project.tilesets[out.tilesetId] as unknown as { tileMeta: Array<{ label?: string } | undefined> };
  const door = tileset.tileMeta.findIndex((meta) => /집 문/u.test(meta?.label ?? ""));
  expect(door).toBeGreaterThan(0);
  const inn = { ...structuredClone(out), id: "map_inn", name: "여관", events: [] } as GameMap;
  project.maps[inn.id] = inn;
  out.events = [];
  for (const map of [out, inn]) map.bgm = { mode: "custom", resourceId: "bgm" };
  (out as unknown as { upperTiles: number[] }).upperTiles[5 * out.width + 5] = door;
  project.startMapId = out.id;
  project.startPos = { x: 10, y: 10 } as Project["startPos"];
  return { project, out, inn, door };
}

const transferCodes = (project: Project): string[] =>
  lintScenePolish(project).map((i) => i.code).filter((c) => c.startsWith("scene-transfer"));

describe("create_transfer_pair — 문 그림 칸이 트리거", () => {
  it("doorAt 이 있으면 트리거는 문 칸, 반대쪽 착지는 문앞 칸·문을 등진다, scene-transfer 경고 0", () => {
    const { project, out, inn } = setup();
    const ctx = { project };
    const result = runTool(ctx, "create_transfer_pair", { a: { mapId: out.id, x: 5, y: 6, doorAt: { x: 5, y: 5 } }, b: { mapId: inn.id, x: 10, y: 14 } });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { eventIdA: string; eventIdB: string; gateA: { x: number; y: number }; landingA: { x: number; y: number } };
    expect(data.gateA).toEqual({ x: 5, y: 5 });
    expect(data.landingA).toEqual({ x: 5, y: 6 });
    const gateA = ctx.project.maps[out.id]!.events.find((e) => e.id === data.eventIdA)!;
    const blocked = !isPassable(ctx.project, ctx.project.maps[out.id]!, 5, 5);
    expect(gateA.pages[0]!.priority).toBe(blocked ? "same" : "below");
    const back = ctx.project.maps[inn.id]!.events.find((e) => e.id === data.eventIdB)!.pages[0]!.commands[0] as { x: number; y: number; direction?: string };
    expect({ x: back.x, y: back.y, direction: back.direction }).toEqual({ x: 5, y: 6, direction: "down" });
    expect(transferCodes(ctx.project)).toEqual([]);
    const unreachable = lintProject(ctx.project).filter((i) => (i.code === "event-unreachable" || i.code === "playerTouch-impassable") && i.eventId === data.eventIdA);
    expect(unreachable).toEqual([]);
  });

  it("trigger:\"front\" 는 옛 동작(문앞 칸 트리거)을 지킨다", () => {
    const { project, out, inn } = setup();
    const ctx = { project };
    const result = runTool(ctx, "create_transfer_pair", { a: { mapId: out.id, x: 5, y: 6, doorAt: { x: 5, y: 5 } }, b: { mapId: inn.id, x: 10, y: 14 }, trigger: "front" });
    expect(result.ok, result.summary).toBe(true);
    expect((result.data as { gateA: unknown }).gateA).toEqual({ x: 5, y: 6 });
  });
});
