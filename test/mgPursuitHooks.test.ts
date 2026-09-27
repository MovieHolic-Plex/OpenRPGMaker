// 명작 공백 #28(2026-09-27) — 추격 포기·문 따라옴 훅(스위치). Ao Oni·Corpse Party 의 「따돌렸다」「문이 열린다」 연출.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { deserialize, serialize } from "@/project/io";
import { initialRuntimeEventPositions, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { carryPursuitThroughDoor, pursuitTarget, toggleHiding } from "@/player/horrorRuntime";
import { parsePursuit } from "@/editor/tools/horrorBehaviorTools";
import type { ChaseAcrossMaps, GameEvent } from "@/project/types";
import type { AutonomousMover } from "@/player/playSceneTypes";

function fixture(pursuit: Partial<ChaseAcrossMaps> = {}) {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.width = 12; map.height = 12; map.lowerTiles = Array(144).fill(0); map.upperTiles = Array(144).fill(-1);
  project.tilesets[map.tilesetId]!.passability[0] = { up: true, down: true, left: true, right: true };
  const event = (id: string, x: number, y: number): GameEvent => ({ id, x, y, trigger: { kind: "action" }, commands: [], pages: [{ id: `${id}_page`, name: id, conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }] });
  const monster = event("monster", 7, 5);
  monster.pages![0]!.movement = { type: "chase", speed: 4, frequency: 4, sightRange: 8,
    pursuit: { scope: "connected", doorDelayMs: 500, searchMs: 1000, onLost: "wait", lostSwitchId: "sw_lost", followSwitchId: "sw_follow", ...pursuit } };
  const closet = event("closet", 3, 4); closet.pages![0]!.interaction = { kind: "hiding" };
  const chair = event("chair", 8, 8); chair.pages![0]!.interaction = { kind: "pushable" };
  map.events = [monster, closet, chair];
  const next = structuredClone(map); next.id = "next"; next.events = []; project.maps.next = next;
  const session = startSession(project); session.x = 3; session.y = 5;
  const world = { project, map, session, positions: initialRuntimeEventPositions(map.events) };
  const view = (id: string) => runtimeEventViewsForMap(project, world.map, session, world.positions).find((v) => v.event.id === id)!;
  const mover = { timer: 0, moveIntervalMs: 80, moveDurationMs: 100, chaseActive: true } as AutonomousMover;
  return { world, view, mover, next };
}

describe("#28 추격 훅", () => {
  it("수색 시간이 다 되어 포기하면 포기 스위치를 켜고, 다시 발견하면 끈다", () => {
    const { world, view, mover } = fixture();
    expect(pursuitTarget(world, view("monster"), mover, 20)).toMatchObject({ searching: false });
    expect(world.session.switches.sw_lost ?? false).toBe(false);
    // 옷장에 숨는 것을 못 봤다 → 수색 → 포기.
    world.session.eventLocations.chair = { mapId: world.map.id, x: 4, y: 5 };
    toggleHiding(world, view("closet"));
    pursuitTarget(world, view("monster"), mover, 600);
    expect(world.session.switches.sw_lost ?? false).toBe(false);
    expect(pursuitTarget(world, view("monster"), mover, 600)).toBeNull();
    expect(world.session.switches.sw_lost).toBe(true);
    expect(world.session.horror!.pursuits.monster!.active).toBe(false);
    // 숨기를 풀고 다시 보이면 끈다.
    toggleHiding(world);
    world.session.eventLocations.chair = { mapId: world.map.id, x: 8, y: 8 };
    mover.chaseActive = true;
    expect(pursuitTarget(world, view("monster"), mover, 20)).toMatchObject({ searching: false });
    expect(world.session.switches.sw_lost).toBe(false);
  });

  it("문을 따라 다른 맵으로 넘어오기 시작하면 따라옴 스위치를 켠다", () => {
    const { world, view, mover, next } = fixture();
    world.session.x = 8; world.session.y = 5;
    pursuitTarget(world, view("monster"), mover, 20);
    carryPursuitThroughDoor(world, new Map([["monster", mover]]), { mapId: next.id, x: 2, y: 2 });
    expect(world.session.switches.sw_follow).toBe(true);
  });

  it("훅이 없는 옛 추격자는 스위치를 건드리지 않고, 저장 왕복·AI 도구가 훅을 보존한다", () => {
    const { world, view, mover, next } = fixture({ lostSwitchId: undefined, followSwitchId: undefined });
    const before = { ...world.session.switches };
    world.session.x = 8; world.session.y = 5;
    pursuitTarget(world, view("monster"), mover, 20);
    carryPursuitThroughDoor(world, new Map([["monster", mover]]), { mapId: next.id, x: 2, y: 2 });
    expect(world.session.switches).toEqual(before);
    const hooked = fixture();
    const loaded = deserialize(serialize(hooked.world.project));
    expect(loaded.maps[hooked.world.map.id]!.events[0]!.pages![0]!.movement.pursuit).toMatchObject({ lostSwitchId: "sw_lost", followSwitchId: "sw_follow" });
    expect(parsePursuit({ scope: "map", doorDelayMs: 0, searchMs: 100, onLost: "wait", lostSwitchId: "sw_lost" })).toEqual({ scope: "map", doorDelayMs: 0, searchMs: 100, onLost: "wait", lostSwitchId: "sw_lost" });
  });
});
