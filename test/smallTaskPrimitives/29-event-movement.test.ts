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
      sentence: "2걸음으로 출발점에 돌아오는 순찰을 설정합니다.",
      pagePatch: {
        movement: { type: "custom", speed: 2, frequency: 2, moveIntervalMs: 2000, route: {
          repeat: true, skippable: false,
          moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }, { kind: "wait" }],
        } },
      },
    };
  },
  "npc.face.set": () => {
    const { project, target, guard } = blank();
    const graphic = guard.pages![0]!.graphic;
    graphic.pattern = charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 2 });
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
    expect(jsonEqual(result.after, {
      ...project, maps: { ...project.maps, [target.mapId]: {
        ...beforeMap, events: beforeMap.events.map(event => event === beforeEvent ? expected : event),
      } },
    })).toBe(true);
    expectRefused(project, { ...target, x: target.x - 1 }, id, args);
    await expectUndoRestores(project, result.after, target);
  }, 120_000);

  it.for([
    [{ kind: "setSwitch", switchId: "sw_missing", value: true }, /스위치/u],
    [{ kind: "npcTransfer", mapId: "map_missing", x: 0, y: 0 }, /목적지 맵/u],
    [{ kind: "turnToward", target: "ev_missing" }, /대상 이벤트/u],
    [{ kind: "turnToward", target: "@this" }, /대상 이벤트/u],
    [{ kind: "turnToward", target: "@player", x: 4, y: 4 }, /대상과 좌표/u],
    [{ kind: "approach", target: "  " }, /형식/u],
    [{ kind: "exitVia", x: 2, y: 2, closeSe: "se_missing" }, /효과음/u],
    [{ kind: "exitVia" }, /출입구가 없어요/u],
    [{ kind: "enterVia", target: "@player" }, /대상 이벤트/u],
    [{ kind: "doorCue", frame: 2 }, /문 이벤트와 열림 단계/u],
    [{ kind: "doorCue", target: "this-event", frame: 2 }, /대상 이벤트/u],
    [{ kind: "doorCue", se: "cc0-se-osx-door-open", ms: 900 }, /형식/u],
    [{ kind: "playSe", resourceId: "easyrpg-charset-people1" }, /효과음/u],
    [{ kind: "changeGraphic", spriteId: "cc0-se-osx-door-open" }, /이벤트 그림/u],
    [{ kind: "placeAt", x: 99, y: 0 }, /이 맵 안/u],
    [{ kind: "placeAt", x: 1.5, y: 0 }, /형식/u],
    [{ kind: "jump", dx: 12, dy: 0 }, /맵의 크기/u],
    [{ kind: "jump", dx: 0, dy: 1, durationMs: 1 }, /형식/u],
    [{ kind: "dropIn", heightPx: 10000 }, /형식/u],
    [{ kind: "changeOpacity", delta: 256 }, /형식/u],
  ] as const)("없는 이동 경로 참조를 거절합니다 (%j)", ([move, message]) => {
    const { project, target } = blank();
    expectRefused(project, target, "move.route.set", { moves: [move] }, message);
  });

  it("정상 대상과 효과음, 소리 없는 문 연출은 경로에 저장합니다", () => {
    const { project, target, map, guard } = blank();
    const moves = [
      { kind: "turnToward", target: "@player" },
      { kind: "approach", target: "", x: 3, y: 3 },
      { kind: "playSe", resourceId: "cc0-se-osx-door-open" },
      { kind: "exitVia", x: 2, y: 2, se: "", closeSe: "" },
    ];
    const { after } = expectApplies(project, target, "move.route.set", { moves });
    expect(pageOf(after, map.id, guard.id).movement.route?.moves).toEqual(moves);
    expectRefused(project, target, "move.route.set", {
      moves: [{ kind: "doorCue", target: guard.id, frame: 2 }],
    }, /다른 문 이벤트/u);
  });

  it("도착 맵에서 같은 자율 이동 경로가 다시 시작되는 맵 이동을 거절합니다", () => {
    const { project, target, map, guard } = blank();
    const other = { ...createBlankMap("다음 지역", 5, 5), id: "map_route_destination" };
    project.maps[other.id] = other;
    const transfer = { kind: "npcTransfer", mapId: other.id, x: 1, y: 1 } as const;
    const wait = { kind: "wait" } as const;
    expectRefused(project, target, "move.route.set", { moves: [{ ...transfer, x: 5 }] }, /맵 범위/u);
    expectRefused(project, target, "move.route.set", { moves: [wait, transfer], repeat: false }, /도착한 맵에서도/u);
    const movement = guard.pages![0]!.movement;
    guard.pages![0]!.movement = { ...movement, type: "custom", route: { moves: [wait, transfer], repeat: false } };
    expectRefused(project, target, "move.route.append", { moves: [wait] }, /기존 경로에 맵 이동/u);
    const arrival = play(project, other.id);
    arrival.session.currentMapId = other.id;
    arrival.session.eventLocations = { [guard.id]: { mapId: other.id, x: 1, y: 1 } };
    registerPageMoveRoutes(arrival);
    expect(arrival.autonomousNPCs.get(guard.id)).toMatchObject({ step: 0, moves: [wait, transfer], repeat: false });
  });

  it("선택한 칸이나 페이지가 바뀌었거나 같은 ID가 두 개면 거절합니다", () => {
    const { project, target, map, guard } = blank();
    const id = "move.speed.set";
    const args = { speed: 5 };
    expectRefused(project, { ...target, pageId: "page_deleted" }, id, args, /범위 밖.*페이지/u);
    expectRefused(project, { ...target, eventId: "ev_deleted" }, id, args, /범위 밖.*이벤트/u);
    expectRefused(project, { ...target, x: 6.5 }, id, args, /범위 밖.*칸/u);
    map.events.push({ ...guard, x: 8 });
    expectRefused(project, target, id, args, /범위 밖.*칸/u);
    map.events.pop();
    guard.pages!.push({ ...guard.pages![0]! });
    expectRefused(project, target, id, args, /범위 밖.*페이지/u);
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

  it("경로가 없는 추격 페이지에 덧붙이기를 요청해도 추격 설정을 바꾸지 않습니다", () => {
    const movement = { type: "chase", speed: 5, frequency: 4, sightRange: 7 } as const;
    const { project, target, map, guard } = blank({ movement });
    expectRefused(project, target, "move.route.append", { moves: [{ kind: "wait" }] }, /덧붙일 이동 경로가 없어요/u);
    expect(pageOf(project, map.id, guard.id).movement).toEqual(movement);
  });

  it("명령과 경로가 최상위에 있는 옛 이벤트는 첫 페이지에 이동 설정을 저장합니다", async () => {
    const { project, map, guard } = blank();
    const commands = guard.pages![0]!.commands;
    const moveRoute = { repeat: false, moves: [{ kind: "move", dir: "right" }] } satisfies NonNullable<GameEvent["moveRoute"]>;
    const old = { ...guard, pages: undefined, commands, moveRoute };
    map.events[0] = old;
    const target = selected(project, map.id, guard.id);
    const { after } = runPrimitive(project, target, "move.speed.set", { speed: 5 });
    expect(after.maps[map.id].events[0]).toMatchObject({
      ...old, pages: [{ conditions: [], commands, movement: { type: "custom", route: moveRoute, speed: 5, frequency: 3 } }],
    });
    await expectUndoRestores(project, after, target);
  });

  it("옛 이벤트의 실행 조건을 페이지 조건으로 바꿔 캐릭터를 숨기는 편집은 거절합니다", () => {
    const { project, map, guard } = blank();
    const switchId = "sw_movement_allowed";
    project.switches.push({ id: switchId, name: "이동 허용" });
    guard.sprite = guard.pages![0]!.graphic.sprite;
    guard.commands = guard.pages![0]!.commands;
    guard.pages = undefined;
    guard.condition = { kind: "switch", switchId, value: true };
    const target = selected(project, map.id, guard.id);
    const scene = play(project, map.id);
    const view = runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)
      .find(entry => entry.event.id === guard.id);
    expect(view?.transparent).toBe(false);
    expectRefused(project, target, "move.speed.set", { speed: 5 }, /실행 조건/u);
  });

  it("순찰은 출발점으로 돌아와야 하며 시작점 가까이 지나갈 수 없습니다", () => {
    const { project, target, guard } = blank();
    expect(() => runPrimitive(project, target, "npc.patrol.set", { directions: ["left", "left"] })).toThrow(/출발점/u);
    project.startPos = { x: guard.x + 1, y: guard.y };
    expect(() => runPrimitive(project, target, "npc.patrol.set", { directions: ["left", "right"] })).toThrow(/시작점/u);
  });

  it("분기 안에서 공용 이벤트를 호출하는 옛 출입구 근처에는 순찰을 놓지 않습니다", () => {
    const { project, target, map, guard } = blank();
    project.commonEvents.push({
      id: "ce_legacy_exit", name: "장소 이동", trigger: "none",
      commands: [{ kind: "callMapEvent", eventId: "ev_exit_destination" }],
    });
    map.events.push(
      { id: "ev_legacy_exit", x: guard.x + 3, y: guard.y, trigger: { kind: "action" }, commands: [
        { kind: "choices", options: [{ text: "나가기", branch: [{ kind: "callCommonEvent", commonEventId: "ce_legacy_exit" }] }] },
      ] },
      { id: "ev_exit_destination", x: 11, y: 11, trigger: { kind: "action" }, commands: [
        { kind: "transfer", mapId: map.id, x: 10, y: 10 },
      ] },
    );
    expectRefused(project, target, "npc.patrol.set", { directions: ["right", "left"] }, /출입구/u);
  });

  it("기존 순찰의 돌기와 대각선 다음에 지나는 칸도 보호합니다", () => {
    const { project, target, map, guard } = blank();
    const otherPage: EventPage = {
      ...guard.pages![0]!, id: "page_other_guard",
      movement: { type: "custom", speed: 3, frequency: 3, route: { repeat: true, moves: [
        { kind: "turn", dir: "left" }, { kind: "moveDiagonal", horizontal: "left", vertical: "down" },
        { kind: "moveDiagonal", horizontal: "right", vertical: "up" },
      ] } },
    };
    map.events.push({ ...guard, id: "ev_other_guard", x: guard.x + 2, y: guard.y - 1, pages: [otherPage] });
    expectRefused(project, target, "npc.patrol.set", { directions: ["right", "left"] }, /다른 이벤트나 순찰/u);
  });

  it("조건부 이벤트의 통행 칸이 순찰 경로와 겹치면 거절합니다", () => {
    const { project, target, map, guard } = blank();
    const page = guard.pages![0]!;
    const switchId = "sw_market_open";
    project.switches.push({ id: switchId, name: "장터가 열림" });
    map.events.push({ ...guard, id: "ev_market_stall", x: guard.x + 2, y: guard.y + 1, pages: [
      { ...page, id: "page_stall_open", priority: "below" },
      { ...page, id: "page_stall_closed", conditions: [{ kind: "switch", switchId, value: false }],
        footprint: { width: 3, height: 2 }, passRows: 2 },
    ] });
    expectRefused(project, target, "npc.patrol.set", { directions: ["right", "left"] }, /다른 이벤트나 순찰/u);
  });

  it("맵 연결과 전투 뒤 이벤트의 도착 칸 가까이에는 순찰을 놓지 않습니다", () => {
    const { project, target, map, guard } = blank();
    const other = { ...createBlankMap("다음 지역", 5, 5), id: "map_connected" };
    project.maps[other.id] = other;
    const to = { mapId: map.id, x: guard.x + 3, y: guard.y };
    project.mapConnections = [{ id: "connection_test", from: { mapId: other.id, x: 1, y: 1 }, to, playerEnabled: true, npcEnabled: false }];
    const patrol = { directions: ["right", "left"] };
    expectRefused(project, target, "npc.patrol.set", patrol, /출입구/u);

    project.mapConnections = [];
    project.database.troops = [{
      id: "troop_movement_test", name: "길 지킴이", enemyIds: [], autoAlign: true, battleEventPages: [],
      afterBattle: { victory: [{ kind: "transfer", ...to }] },
    }];
    expectRefused(project, target, "npc.patrol.set", patrol, /출입구/u);
  });

  it("실제로 불러올 수 없는 걷기 그림에는 순찰을 설정하지 않습니다", () => {
    const { project, target } = blank({ graphic: { sprite: { type: "bundled", id: "sprite_missing" } } });
    expectRefused(project, target, "npc.patrol.set", { directions: ["right", "left"] }, /보이는 한 칸/u);
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

  it("연결한 외형의 가운데 발 모양을 보존하며 처음 바라보는 방향을 바꿉니다", () => {
    const sprite = { type: "bundled", id: "tex_easyrpg_charset_people1" } as const;
    const { project, target, map, guard } = blank({ graphic: { appearanceId: "appearance_guard", sprite } });
    project.database.characterAppearances = [{
      id: "appearance_guard", name: "문지기 외형", description: "", charset: { resourceId: sprite.id, characterIndex: 3 },
    }];
    const { after } = expectApplies(project, target, "npc.face.set", { direction: "up" });
    expect(pageOf(after, map.id, guard.id).graphic).toEqual({ appearanceId: "appearance_guard", sprite, direction: "up" });
    const scene = play(after, map.id);
    const view = runtimeEventViewsForMap(after, scene.map, scene.session, scene.eventPositions).find(row => row.event.id === guard.id);
    expect(decodeCharsetFrameIndex(view!.page!.graphic.pattern!)).toEqual({ characterIndex: 3, direction: "up", pattern: 1 });
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

  it("같은 맵에서 지정한 칸으로 옮기는 단계는 선택한 이벤트에만 적용합니다", () => {
    const { project, target, map, guard } = blank();
    const { after } = runPrimitive(project, target, "move.route.set", {
      moves: [{ kind: "placeAt", x: 2, y: 2 }], repeat: false,
    });
    const scene = play(after, map.id);
    updateAutonomousNPCs(scene, npcMoveIntervalMs(3));
    expect(scene.eventPositions[guard.id]).toMatchObject({ x: 2, y: 2 });
    expect(scene.eventPositions[map.events[1]!.id]).toMatchObject({ x: 10, y: 10 });
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
