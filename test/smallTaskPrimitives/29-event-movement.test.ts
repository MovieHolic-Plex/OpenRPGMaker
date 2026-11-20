/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { npcMoveDurationMs, npcMoveIntervalMs } from "@/project/characterMotion";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { initialRuntimeEventPositions, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { eventTarget as selected, expectApplies, expectRefused, expectUndoRestores, loadFixture } from "./harness";

const BAZAAR_MAP = "map_1c3b4f24-9d3d-4c31-9d24-4dbda2df705d";
const CAVE_MAP = "map_638339b3-341f-4d31-93bd-ccc90a33304a";
const CAVE_FOE = "ev_map_638339b3-341f-4d31-93bd-ccc90a33304a_wfoe1";
const PARK_MAP = "map_mk_park";
const PARK_CHILD = "ev_mk_pk_kid";

function pageOf(project: Project, mapId: string, eventId: string, index = 0): EventPage {
  return project.maps[mapId].events.find(event => event.id === eventId)!.pages![index]!;
}

function blank(pagePatch: Partial<EventPage> = {}) {
  const project = loadFixture("blank");
  const map = { ...createBlankMap("산책길", 12, 12), id: "map_movement_test" };
  const sprite = { type: "bundled", id: "tex_easyrpg_charset_people1" } as const;
  const guard: GameEvent = {
    id: "ev_movement_guard", name: "문지기", x: 6, y: 6, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: "page_guard_base", name: "근무", conditions: [], graphic: { sprite, direction: "down" },
      trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "산책하기 좋은 날이군요." }], ...pagePatch,
    }],
  };
  map.events = [guard, { id: "ev_movement_sign", x: 10, y: 10, trigger: { kind: "action" }, commands: [] }];
  project.maps = { [map.id]: map };
  project.startMapId = map.id;
  project.startPos = { x: 1, y: 1 };
  project.mapTree = { mapId: map.id, children: [] };
  return { project, map, guard, target: selected(project, map.id, guard.id) };
}

type EditCase = {
  project: Project;
  target: ReturnType<typeof selected>;
  args: Record<string, unknown>;
  sentence: string;
  pagePatch: Partial<EventPage>;
};

const cases: Record<string, () => EditCase> = {
  "move.route.set": () => {
    const project = loadFixture("built");
    const target = selected(project, BAZAAR_MAP, "ev_supply_shop", "ev_supply_shop_active");
    const moves = [{ kind: "move", dir: "left" }, { kind: "wait" }] as const;
    return {
      project, target, args: { moves, repeat: false, skippable: true },
      sentence: "이동 경로를 2단계로 바꿉니다.",
      pagePatch: { movement: { speed: 3, frequency: 3, type: "custom", route: { moves: [...moves], repeat: false, skippable: true } } },
    };
  },
  "move.route.append": () => {
    const project = loadFixture("built");
    const target = selected(project, CAVE_MAP, CAVE_FOE);
    const old = pageOf(project, CAVE_MAP, CAVE_FOE).movement;
    const moves = [{ kind: "turn", dir: "left" }] as const;
    return {
      project, target, args: { moves }, sentence: "이동 경로 끝에 1단계를 더합니다.",
      pagePatch: { movement: { ...old, route: { ...old.route!, moves: [...old.route!.moves, ...moves] } } },
    };
  },
  "move.type.set": () => {
    const { project, target } = blank();
    return {
      project, target, args: { type: "approach" }, sentence: "주인공 쪽으로 다가가게 합니다.",
      pagePatch: { movement: { speed: 3, frequency: 3, type: "approach" } },
    };
  },
  "move.speed.set": () => {
    const { project, target } = blank({ movement: { speed: 3, frequency: 5, type: "random" } });
    return {
      project, target, args: { speed: 6 }, sentence: "이동 속도를 6단계로 바꿉니다.",
      pagePatch: { movement: { speed: 6, frequency: 5, type: "random" } },
    };
  },
  "move.frequency.set": () => {
    const project = loadFixture("built");
    const target = selected(project, CAVE_MAP, CAVE_FOE);
    const route = pageOf(project, CAVE_MAP, CAVE_FOE).movement.route!;
    return {
      project, target, args: { frequency: 8 }, sentence: "이동 빈도를 8단계로 바꿉니다.",
      pagePatch: { movement: { speed: 3, frequency: 8, type: "custom", route } },
    };
  },
  "npc.patrol.set": () => {
    const { project, target } = blank();
    return {
      project, target, args: { directions: ["right", "left"], intervalMs: 2000 },
      sentence: "2걸음을 돌아 출발점으로 오는 순찰을 설정합니다.",
      pagePatch: {
        movement: { type: "custom", speed: 2, frequency: 2, moveIntervalMs: 2000, route: {
          repeat: true, skippable: false,
          moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }, { kind: "wait" }],
        } },
      },
    };
  },
  "npc.face.set": () => {
    const project = loadFixture("maou");
    const target = selected(project, PARK_MAP, PARK_CHILD, "ev_mk_pk_kid_p");
    const graphic = pageOf(project, PARK_MAP, PARK_CHILD).graphic;
    const pattern = charsetFrameIndex({ ...decodeCharsetFrameIndex(graphic.pattern!), direction: "left" });
    return {
      project, target, args: { direction: "left", fixed: true }, sentence: "항상 왼쪽을 바라보게 합니다.",
      pagePatch: { graphic: { ...graphic, direction: "left", pattern }, animationType: "fixedDirection" },
    };
  },
};

describe("선택한 이벤트 페이지의 이동 편집", () => {
  it.for(Object.entries(cases))("%s 저장값, 한국어 미리보기, 범위, 되돌리기", async ([id, setup]) => {
    const { project, target, args, sentence, pagePatch } = setup();
    const beforeMap = project.maps[target.mapId];
    const beforeEvent = beforeMap.events.find(event => event.id === target.eventId)!;
    const snapshot = structuredClone(beforeEvent);
    const index = target.pageId === undefined ? 0 : beforeEvent.pages!.findIndex(page => page.id === target.pageId);
    const expected = {
      ...beforeEvent, pages: beforeEvent.pages!.map((page, i) => i === index ? { ...page, ...pagePatch } : page),
    };
    const result = expectApplies(project, target, id, args);

    expect(result.sentence).toBe(sentence);
    expect(jsonEqual(project.maps[target.mapId].events.find(event => event.id === target.eventId), snapshot)).toBe(true);
    expect(result.after.maps[target.mapId]).toEqual({
      ...beforeMap, events: beforeMap.events.map(event => event === beforeEvent ? expected : event),
    });
    expectRefused(project, { ...target, x: target.x - 1 }, id, args);
    await expectUndoRestores(project, result.after, target);
  }, 120_000);

  it.for([
    [{ kind: "setSwitch", switchId: "sw_missing", value: true }, /스위치/u],
    [{ kind: "npcTransfer", mapId: "map_missing", x: 0, y: 0 }, /목적지 맵/u],
    [{ kind: "turnToward", target: "ev_missing" }, /대상 이벤트/u],
    [{ kind: "exitVia", closeSe: "se_missing" }, /효과음/u],
    [{ kind: "placeAt", x: 99, y: 0 }, /이 맵 안/u],
  ] as const)("없는 이동 경로 참조를 거절합니다 (%j)", ([move, message]) => {
    const { project, target } = blank();
    expect(() => runPrimitive(project, target, "move.route.set", { moves: [move] })).toThrow(message);
  });

  it("저장된 경로에 덧붙일 때 정지 상태와 반복, 대기, 건너뛰기 설정을 보존합니다", () => {
    const route = { moves: [{ kind: "wait" }], repeat: false, wait: true, skippable: true } as const;
    const { project, target, map, guard } = blank({
      movement: { speed: 3, frequency: 3, type: "fixed", route: { ...route, moves: [...route.moves] } },
    });
    const { after } = runPrimitive(project, target, "move.route.append", { moves: [{ kind: "stepForward" }] });
    expect(pageOf(after, map.id, guard.id).movement).toEqual({
      speed: 3, frequency: 3, type: "fixed", route: { ...route, moves: [...route.moves, { kind: "stepForward" }] },
    });
  });

  it("기존 조건, 명령, 경로가 최상위에 있는 옛 이벤트에도 페이지 이동 설정을 저장합니다", async () => {
    const { project, map, guard } = blank();
    const commands = guard.pages![0]!.commands;
    const switchId = "sw_movement_allowed";
    project.switches.push({ id: switchId, name: "이동 허용" });
    const condition = { kind: "switch", switchId, value: true } as const;
    const moveRoute = { repeat: false, moves: [{ kind: "move", dir: "right" }] } satisfies NonNullable<GameEvent["moveRoute"]>;
    const old = { ...guard, pages: undefined, condition, commands, moveRoute };
    map.events[0] = old;
    const target = selected(project, map.id, guard.id);
    const { after } = runPrimitive(project, target, "move.speed.set", { speed: 5 });
    expect(after.maps[map.id].events[0]).toMatchObject({
      ...old, pages: [{ conditions: [condition], commands, movement: { type: "custom", route: moveRoute, speed: 5, frequency: 3 } }],
    });
    await expectUndoRestores(project, after, target);
  });

  it("순찰은 출발점으로 돌아와야 하며 시작점 가까이 지나갈 수 없습니다", () => {
    const { project, target, guard } = blank();
    expect(() => runPrimitive(project, target, "npc.patrol.set", { directions: ["left", "left"] })).toThrow(/출발점/u);
    project.startPos = { x: guard.x + 1, y: guard.y };
    expect(() => runPrimitive(project, target, "npc.patrol.set", { directions: ["left", "right"] })).toThrow(/시작점/u);
  });

  it("순찰을 추가해도 선택한 페이지의 추격 설정이 이어집니다", () => {
    const { project, target, map, guard } = blank({
      movement: { type: "chase", speed: 5, frequency: 4, sightRange: 7 },
    });
    const { after } = runPrimitive(project, target, "npc.patrol.set", { directions: ["right", "left"] });
    expect(pageOf(after, map.id, guard.id).movement).toMatchObject({
      type: "chase", speed: 5, frequency: 4, sightRange: 7, pursuit: { onLost: "return" },
      route: { moves: [{ kind: "move", dir: "right" }, { kind: "wait" }, { kind: "move", dir: "left" }, { kind: "wait" }] },
    });
  });

  it("방향 고정을 켜고 풀어도 제자리 걷기 설정을 보존합니다", () => {
    const { project, target, map, guard } = blank({ animationType: "step" });
    const lock = runPrimitive(project, target, "npc.face.set", { direction: "up", fixed: true });
    expect(pageOf(lock.after, map.id, guard.id).animationType).toBe("fixedDirectionStep");
    const unlock = runPrimitive(lock.after, target, "npc.face.set", { direction: "right", fixed: false });
    expect(pageOf(unlock.after, map.id, guard.id)).toMatchObject({ animationType: "step", graphic: { direction: "right" } });
  });
});

function play(project: Project, mapId: string, tileX = 1, tileY = 1) {
  store.replaceProject(project);
  const map = project.maps[mapId];
  const scene: Parameters<typeof registerPageMoveRoutes>[0] & Parameters<typeof updateAutonomousNPCs>[0] = {
    map,
    session: startSession(project),
    eventPositions: initialRuntimeEventPositions(map.events),
    pageMoveRouteKeys: new Set(),
    pageMoveRouteEventIds: new Set(),
    autonomousNPCs: new Map(),
    registerAutonomousMover: (id, moves, repeat) => registerAutonomousMover(scene, id, moves, repeat),
    tileX, tileY, eventSprites: new Map(),
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
  };
  registerPageMoveRoutes(scene);
  return scene;
}

describe("헤드리스 플레이의 자율 이동", () => {
  it("교체한 경로가 한 칸 이동하고 반복 없이 끝납니다", () => {
    const { project, target, map, guard } = blank();
    const { after } = runPrimitive(project, target, "move.route.set", { moves: [{ kind: "move", dir: "right" }], repeat: false });
    const scene = play(after, map.id);
    updateAutonomousNPCs(scene, npcMoveIntervalMs(3));
    expect(scene.eventPositions[guard.id]).toEqual({ x: 7, y: 6, direction: "right" });
    updateAutonomousNPCs(scene, npcMoveDurationMs(3));
    expect(scene.autonomousNPCs.get(guard.id)?.moves).toEqual([]);
  });

  it("순찰이 막히면 걸음을 건너뛰지 않고 기다렸다가 출발점으로 돌아옵니다", () => {
    const { project, target, map, guard } = blank();
    const { after } = runPrimitive(project, target, "npc.patrol.set", { directions: ["right", "left"] });
    const scene = play(after, map.id, 7, 6);
    updateAutonomousNPCs(scene, 1600);
    expect(scene.eventPositions[guard.id]).toMatchObject({ x: 6, y: 6 });
    expect(scene.autonomousNPCs.get(guard.id)?.step).toBe(0);
    scene.tileX = 1;
    scene.tileY = 1;
    updateAutonomousNPCs(scene, 1600);
    expect(scene.eventPositions[guard.id]).toMatchObject({ x: 7, y: 6 });
    updateAutonomousNPCs(scene, npcMoveDurationMs(2));
    updateAutonomousNPCs(scene, 3200);
    expect(scene.eventPositions[guard.id]).toMatchObject({ x: 6, y: 6 });
  });

  it("접근 이동과 새 속도·빈도가 플레이에 반영됩니다", () => {
    const { project, target, map, guard } = blank();
    const approaching = runPrimitive(project, target, "move.type.set", { type: "approach" }).after;
    const withSpeed = runPrimitive(approaching, target, "move.speed.set", { speed: 6 }).after;
    const after = runPrimitive(withSpeed, target, "move.frequency.set", { frequency: 8 }).after;
    const scene = play(after, map.id, 9, 6);
    const mover = scene.autonomousNPCs.get(guard.id);
    expect(mover).toMatchObject({ strategy: "approach", moveDurationMs: npcMoveDurationMs(6), moveIntervalMs: npcMoveIntervalMs(8) });
    updateAutonomousNPCs(scene, npcMoveIntervalMs(8) - 1);
    expect(scene.eventPositions[guard.id]?.x).toBe(6);
    updateAutonomousNPCs(scene, 1);
    expect(scene.eventPositions[guard.id]?.x).toBe(7);
  });

  it("고정 방향을 바라보면서 다른 방향으로 이동할 수 있습니다", () => {
    const { project, target, map, guard } = blank();
    const routed = runPrimitive(project, target, "move.route.set", { moves: [{ kind: "move", dir: "right" }] }).after;
    const { after } = runPrimitive(routed, target, "npc.face.set", { direction: "up", fixed: true });
    const scene = play(after, map.id);
    const view = runtimeEventViewsForMap(after, scene.map, scene.session, scene.eventPositions).find(row => row.event.id === guard.id);
    expect(view?.direction).toBe("up");
    updateAutonomousNPCs(scene, npcMoveIntervalMs(3));
    expect(scene.eventPositions[guard.id]).toEqual({ x: 7, y: 6, direction: "up" });
  });
});
