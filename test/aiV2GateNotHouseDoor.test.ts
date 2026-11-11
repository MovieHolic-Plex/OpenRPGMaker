// 「들어갈 수 없다」 한 줄(조사 키)은 칩셋 키트가 적어 둔 건물 입구에만 선다 — 걸어서 지나는 문(성문·아치·목책 문)의 기둥에는 서지 않고, 전에 세운 것은 걷어 낸다.
// 2026-11-11 Terra 게임 둘의 「굳게 닫힌 집 문」 27개가 전부 성문 기둥에 서 있었고, 눈가림 플레이어는 궁전에 들어가지 않았다.
// 같은 날 단계×테마 표: 구성기 칩셋 바깥 맵 36장 가운데 35장에서 진짜 집 문은 하나도 반응하지 않았다(집은 키트 한 덩이라 문 이름표가 없다).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import type { GameEvent, Project } from "@/project/types";
import { doorArtCells, reachableCells } from "@/ai/v2/judge/eventReach";
import { buildingEntrances } from "@/ai/v2/place/entrances";
import { lockBareHouseDoors } from "@/ai/v2/place/lockedDoors";
import { VILLAGE_BUILDER } from "@/ai/v2/place/builders/village";
import type { BuildRun } from "@/ai/v2/shared/types";

const locked = (project: Project, mapId: string) => project.maps[mapId]!.events.filter((e) => e.id.startsWith("ev_locked_door_"));
const at = (cells: readonly { x: number; y: number }[], e: { x: number; y: number }) => cells.some((c) => c.x === e.x && c.y === e.y);

function desert(kind: string): { project: Project } {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "create_map", { id: "map_p", name: "사막", width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
  expect(runTool(ctx, "compose_desert_east_map", { mapId: "map_p", kind, seed: 1 }).ok).toBe(true);
  return ctx;
}

const triggerKinds = (ev: GameEvent) => [(ev.trigger as { kind?: string }).kind, ...(ev.pages ?? []).map((p) => (p.trigger as { kind?: string }).kind)];

describe("the «cannot enter» line stands on declared building entrances only", () => {
  it("answers every building door cell a player can stand at, and leaves the gate posts alone", () => {
    const ctx = desert("palace");
    const map = ctx.project.maps.map_p!;
    // 이름표로 읽은 「문」은 이 맵에서 성문뿐이고, 건물 입구와 한 칸도 겹치지 않는다.
    const gatePosts = doorArtCells(ctx.project, map);
    const entrances = buildingEntrances(ctx.project, map);
    expect(gatePosts.length).toBeGreaterThan(0);
    expect(entrances.length).toBeGreaterThan(0);
    expect(gatePosts.some((g) => at(entrances, g))).toBe(false);
    lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
    const lines = locked(ctx.project, "map_p");
    const reach = reachableCells(ctx.project, map)!;
    const standable = entrances.filter((e) => reach[e.front.y * map.width + e.front.x]);
    expect(standable.length).toBeGreaterThan(0);
    expect(lines.length).toBe(standable.length);
    for (const d of lines) {
      expect(at(standable, d)).toBe(true);
      expect(at(gatePosts, d)).toBe(false);
      expect(isPassable(ctx.project, ctx.project.maps.map_p!, d.x, d.y)).toBe(false);
    }
    // 다시 돌려도 같다.
    expect(lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p")).toEqual([]);
    expect(locked(ctx.project, "map_p").length).toBe(lines.length);
  }, 60_000);

  it("answers the action key, not a bump — and turns the lines an earlier build made answer on touch", () => {
    // 출하 플레이어(scripts/qa/runtime/locked-entrance.scenario.mjs): 막힌 문 칸의 접촉 이벤트는 밀 때마다 대사창을 띄우고 조사 키에는 답하지 않는다.
    const ctx = desert("oasis");
    lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
    const lines = locked(ctx.project, "map_p");
    expect(lines.length).toBeGreaterThan(0);
    for (const d of lines) expect(new Set(triggerKinds(d))).toEqual(new Set(["action"]));
    const map = ctx.project.maps.map_p!;
    const touch = { kind: "playerTouch" } as const;
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map, events: map.events.map((e) => e.id.startsWith("ev_locked_door_") ? { ...e, trigger: touch, pages: (e.pages ?? []).map((p) => ({ ...p, trigger: touch })) } as GameEvent : e) } } };
    const notes = lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
    expect(notes.join(" ")).toContain("조사 키");
    const again = locked(ctx.project, "map_p");
    expect(again.length).toBe(lines.length);
    for (const d of again) expect(new Set(triggerKinds(d))).toEqual(new Set(["action"]));
  }, 60_000);

  it("removes the ones an earlier build left on gate posts", () => {
    const ctx = desert("palace");
    const map = ctx.project.maps.map_p!;
    const post = doorArtCells(ctx.project, map)[0]!;
    const stray = { id: `ev_locked_door_${post.x}_${post.y}`, name: "굳게 닫힌 집 문", x: post.x, y: post.y, trigger: { kind: "playerTouch" }, commands: [], pages: [] } as unknown as GameEvent;
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map, events: [...map.events, stray] } } };
    const notes = lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
    expect(notes.join(" ")).toContain(`(${post.x},${post.y})`);
    expect(locked(ctx.project, "map_p").some((e) => e.x === post.x && e.y === post.y)).toBe(false);
  }, 60_000);

  it("skips a door that leads somewhere — and takes its line away once it does —, a map laid as a room, and names no theme", () => {
    const ctx = desert("oasis");
    expect(lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p", "room")).toEqual([]);
    expect(locked(ctx.project, "map_p")).toEqual([]);
    lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p", "outdoor");
    const first = locked(ctx.project, "map_p")[0]!;
    // 그 맵이 무엇인지 이 단계는 모른다 — 「집」「동굴」 같은 말을 쓰지 않는다.
    expect(JSON.stringify(locked(ctx.project, "map_p"))).not.toMatch(/집|동굴|잠겨|house|cave/u);
    // 그 문 앞에 이동 칸이 생기면(이제 들어갈 수 있다) 한 줄을 걷어 낸다 — 조사 키가 «들어갈 수 없다»고 답하면 안 된다.
    const map = ctx.project.maps.map_p!;
    const transfer = { id: "ev_in", name: "안으로", x: first.x, y: first.y + 1, trigger: { kind: "playerTouch" }, commands: [], pages: [{ id: "ev_in_p0", conditions: [], trigger: { kind: "playerTouch" }, commands: [{ kind: "transfer", mapId: "map_p", x: 1, y: 1 }] }] } as unknown as GameEvent;
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map, events: [...map.events, transfer] } } };
    const notes = lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p", "outdoor");
    expect(notes.join(" ")).toContain(`(${first.x},${first.y})`);
    expect(locked(ctx.project, "map_p").some((d) => d.x === first.x && d.y === first.y)).toBe(false);
    expect(locked(ctx.project, "map_p").length).toBeGreaterThan(0);
  }, 60_000);

  it("leaves a line somebody rewrote alone — a door that opens with a key stays as written", () => {
    const ctx = desert("oasis");
    lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
    const map = ctx.project.maps.map_p!;
    const first = locked(ctx.project, "map_p")[0]!;
    const keyed = { ...first, trigger: { kind: "playerTouch" }, pages: [{ ...first.pages![0]!, trigger: { kind: "playerTouch" }, commands: [{ kind: "fork", condition: { kind: "item", itemId: "item_old_key", present: true }, then: [{ kind: "text", body: "문이 열렸다." }], else: [{ kind: "text", body: "잠겨 있다." }] }] }] } as unknown as GameEvent;
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map, events: map.events.map((e) => e.id === first.id ? keyed : e) } } };
    expect(lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p")).toEqual([]);
    expect(ctx.project.maps.map_p!.events.find((e) => e.id === first.id)).toEqual(keyed);
  }, 60_000);

  it("still answers the doors of Beodeul village houses nobody can enter", () => {
    const ctx = { project: createBlankProject() };
    const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun;
    const built = VILLAGE_BUILDER.build(run, { type: "village", name: "시험", theme: "plain" });
    expect(built.ok, built.summary).toBe(true);
    const mapId = built.mapIds[0]!;
    const map = ctx.project.maps[mapId]!;
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, [mapId]: { ...map, events: map.events.filter((e) => !e.id.startsWith("ev_locked_door_")) } } };
    lockBareHouseDoors({ ctx } as unknown as BuildRun, mapId);
    const doors = locked(ctx.project, mapId);
    expect(doors.length).toBeGreaterThan(0);
    const entrances = buildingEntrances(ctx.project, ctx.project.maps[mapId]!);
    for (const d of doors) expect(at(entrances, d)).toBe(true);
  }, 90_000);
});
