/** @vitest-environment happy-dom */
import { beforeAll, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { getMapEditHistoryDepth, resetMapEditHistory } from "@/editor/mapEditHistory";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/23-map-structure";
import { dbTarget, mapTarget } from "@/editor/smallTask/target";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { pickEncounterTroopForMap } from "@/player/encounters";
import { createInterpreter } from "@/player/interpreter";
import { firstConnectionToward } from "@/player/npcLivingTravel";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { doorKindName } from "@/project/eventCommands/doorAnimation";
import { startSession } from "@/project/session";
import { own } from "@/project/spatial/domain";
import { store } from "@/project/store";
import type { Command, GameMap, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { geographyFixture, geographyRoot } from "../support/spatialGeographyFixture";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

const firstId = "map_작은마을";
const secondId = "map_건너편";
const newId = "map_small_task_1";
const villageId = "map_1c3b4f24-9d3d-4c31-9d24-4dbda2df705d";
const troopId = "troop_slime";

function transferEvent(mapId: string) {
  return {
    id: "ev_door", name: "광장 정문", x: 2, y: 3,
    trigger: { kind: "action" } as const,
    commands: [{ kind: "transfer", mapId, x: 3, y: 4 }] as Command[],
  };
}

let blank: Project;
let built: Project;
let maou: Project;

beforeAll(() => {
  blank = loadFixture("blank");
  const create = MAP_TOOLS.find(tool => tool.name === "create_map")!;
  create.run(blank, { id: firstId, name: "작은 마을", width: 20, height: 15, bgm: { mode: "none" } });
  create.run(blank, { id: secondId, name: "강 건너", width: 12, height: 10, bgm: { mode: "none" } });
  built = loadFixture("built");
  maou = loadFixture("maou");
  for (const fixture of [built, maou]) {
    ensureSwitchVariableSlots(fixture);
    removeLegacySpriteReferences(fixture);
  }
}, 240_000);

function blankProject(): Project {
  return { ...blank, maps: structuredClone(blank.maps), mapTree: structuredClone(blank.mapTree), mapConnections: [] };
}

type Args = Record<string, unknown>;

async function expectEdit(project: Project, mapId: string, primitiveId: string, args: Args, inspect: (after: Project, before: Project) => void) {
  const target = mapTarget(project, mapId)!;
  const snapshot = { ...project, maps: structuredClone(project.maps), mapTree: structuredClone(project.mapTree),
    mapConnections: structuredClone(project.mapConnections), startPos: { ...project.startPos } };
  const result = runPrimitive(project, target, primitiveId, args);
  inspect(result.after, project);
  expectKoreanSentence(result.sentence, target);
  expect(jsonEqual(project, snapshot)).toBe(true);
  const primitive = PRIMITIVES.find(row => row.id === primitiveId)!;
  const scope = primitive.scope({ project, target }, args);
  const changed = { ...result.after, meta: { ...result.after.meta, title: "요청 범위 바깥 제목" } };
  const refused = checkSmallTaskScope(project, changed, scope);
  expect(refused.ok).toBe(false);
  if (!refused.ok) expect(refused.reason).toMatch(/범위 밖.*프로젝트 정보/u);
  await expectUndoRestores(project, result.after, target);
}

function run(project: Project, mapId: string, id: string, args: Args) {
  return runPrimitive(project, mapTarget(project, mapId)!, id, args).after;
}

function play(project: Project, map: GameMap, commands: Command[], x = 3, y = 4) {
  const session = startSession(project, 123);
  Object.assign(session, { currentMapId: map.id, x, y });
  return createInterpreter(commands, session, project).start();
}

it("새 맵 한 장을 기본 타일로 채우고 맵 목록에 넣는다", async () => {
  await expectEdit(blankProject(), firstId, "map.structure.create", { name: "안개 부두", width: 9, height: 6 }, (after, before) => {
    const added = after.maps[newId]!;
    expect(added).toMatchObject({ id: newId, name: "안개 부두", width: 9, height: 6,
      tilesetId: before.maps[firstId]!.tilesetId, events: [] });
    expect(added.lowerTiles).toHaveLength(54);
    expect(added.upperTiles).toEqual(Array(54).fill(-1));
    expect(after.mapTree.children.at(-1)).toEqual({ mapId: newId, children: [] });
    expect(after.startMapId).toBe(firstId);
  });
});

it("맵 복제는 원본을 보존하고 복제한 이벤트의 내부 이동을 복사본으로 잇는다", async () => {
  const project = blankProject();
  project.maps[secondId]!.events = [transferEvent(secondId)];
  await expectEdit(project, secondId, "map.structure.duplicate", { name: "강 건너 저녁" }, (after, before) => {
    const copy = after.maps[newId]!;
    expect(copy.name).toBe("강 건너 저녁");
    expect(copy.lowerTiles).toEqual(before.maps[secondId]!.lowerTiles);
    expect(copy.lowerTiles).not.toBe(before.maps[secondId]!.lowerTiles);
    expect(copy.events[0]!.id).not.toBe("ev_door");
    expect(copy.events[0]!.commands).toEqual([{ kind: "transfer", mapId: newId, x: 3, y: 4 }]);
    expect(after.mapTree.children.map(row => row.mapId)).toEqual([secondId, newId]);
    expect(play(after, copy, copy.events[0]!.commands)).toMatchObject({ kind: "transfer", mapId: newId, x: 3, y: 4 });
  });
});

it("복제본의 장소 조건과 NPC 일정은 복제본을 가리키고 외부 이동은 그대로 둔다", async () => {
  const project = blankProject();
  const map = project.maps[secondId]!;
  const door = transferEvent(firstId);
  map.locations = [{ id: "loc1", name: "정문", x: door.x, y: door.y, w: 1, h: 1 }];
  map.events = [door, {
    ...transferEvent(secondId), id: "ev_guide",
    schedule: [{ when: {}, at: { mapId: secondId, x: 2, y: 3 } }],
    commands: [{ kind: "loop", body: [{
      kind: "fork", condition: { kind: "insideLocation", locationId: "loc1", eventId: door.id, inside: true },
      then: [{ kind: "moveEvent", eventId: door.id, route: {
        repeat: false, moves: [{ kind: "npcTransfer", mapId: secondId, x: 3, y: 4 }],
      } }],
    }] }],
  }];
  await expectEdit(project, secondId, "map.structure.duplicate", { name: "새 나루" }, after => {
    const [copiedDoor, copiedGuide] = after.maps[newId]!.events;
    expect(copiedDoor!.commands).toEqual(door.commands);
    expect(copiedGuide!.schedule?.[0]?.at.mapId).toBe(newId);
    expect(copiedGuide!.commands).toMatchObject([{ body: [{
      condition: { eventId: copiedDoor!.id, locationId: "loc1" },
      then: [{ eventId: copiedDoor!.id, route: { moves: [{ mapId: newId, x: 3, y: 4 }] } }],
    }] }]);
  });
});

it("참조 없는 맵을 지울 때 그 맵의 하위 맵은 목록에 남긴다", async () => {
  const project = blankProject();
  const childId = "map_작업실";
  project.maps[childId] = { ...project.maps[secondId]!, id: childId, name: "작업실" };
  project.mapTree.children[0]!.children.push({ mapId: childId, children: [] });
  await expectEdit(project, secondId, "map.structure.remove", {}, (after, before) => {
    expect(Object.keys(after.maps)).toEqual([firstId, childId]);
    expect(after.mapTree).toEqual({ mapId: firstId, children: [{ mapId: childId, children: [] }] });
    expect(after.maps[childId]).toEqual(before.maps[childId]);
  });
});

it.each([firstId, secondId])("%s의 미저장 이동 초안을 실행과 적용 단계에서 보호한다", (ownerId) => {
  const project = blankProject();
  const original = transferEvent(ownerId);
  project.maps[ownerId]!.events = [{ ...transferEvent(secondId), name: "미저장 출입구",
    draft: { kind: "edit", original } }];
  store.replaceProject(project);
  resetMapEditHistory();
  const live = store.getCurrent();
  const target = mapTarget(live, secondId)!;
  const before = smallTaskBase(live, target);
  const id = "map.structure.remove";
  const { after } = runPrimitive(before, target, id, {});
  expect(() => runPrimitive(before, target, id, {}, undefined, live)).toThrow(/미저장 출입구/u);
  expect(() => commitSmallTask(live, before, after, target)).toThrow(/미저장 출입구/u);
  expect(store.getCurrent()).toBe(live);
  expect(getMapEditHistoryDepth()).toBe(0);
});

it("축소하거나 확장할 때 기존 타일 위치와 이벤트의 이동 목적지를 보존한다", async () => {
  const project = blankProject();
  const map = project.maps[firstId]!;
  const oldIndex = 4 * map.width + 3;
  map.upperTiles[oldIndex] = 7;
  map.shadowBits = Array(map.width * map.height).fill(0);
  map.shadowBits[oldIndex] = 1;
  map.events = [transferEvent(firstId)];
  await expectEdit(project, firstId, "map.structure.resize", { width: 23, height: 14 }, (after, before) => {
    const changed = after.maps[firstId]!;
    expect(changed).toMatchObject({ width: 23, height: 14, events: before.maps[firstId]!.events });
    expect(changed.lowerTiles).toHaveLength(23 * 14);
    expect(changed.upperTiles[4 * 23 + 3]).toBe(7);
    expect(changed.shadowBits?.[4 * 23 + 3]).toBe(1);
    expect(play(after, changed, changed.events[0]!.commands)).toMatchObject({ kind: "transfer", mapId: firstId, x: 3, y: 4 });
  });
});

it("다른 맵의 저장된 이동과 미저장 이동을 모두 확인한 뒤 맵을 줄인다", () => {
  const project = blankProject();
  const original = transferEvent(secondId);
  project.maps[firstId]!.events = [original];
  const target = mapTarget(project, secondId)!;
  const resize = (x: number) => runPrimitive(project, target, "map.structure.resize", { width: 9 }, undefined, {
    maps: { [firstId]: { events: [{ ...original, commands: [{ kind: "transfer", mapId: secondId, x, y: 4 }],
      draft: { kind: "edit", original } }] } },
  }).after;
  expect(() => resize(10)).toThrow(/기존 영역이 맵 밖/u);
  const after = resize(8);
  expect(after.maps[secondId]!.width).toBe(9);
  expect(after.maps[firstId]!.events).toBe(project.maps[firstId]!.events);
  expect(after.maps[firstId]!.events[0]!.commands).toEqual(original.commands);
});

it("동일한 기존 오류가 있어도 새로 범위를 벗어나는 게임오버 복구 위치를 막는다", () => {
  const project = blankProject();
  project.system = {
    ...project.system,
    gameOver: { recovery: { mapId: secondId, x: 10, y: 4 } },
    gameOvers: [{ id: "go_other", name: "다른 복구", settings: { recovery: { mapId: firstId, x: 25, y: 4 } } }],
  };
  expect(run(project, secondId, "map.structure.resize", { width: 11 }).maps[secondId]!.width).toBe(11);
  expect(() => run(project, secondId, "map.structure.resize", { width: 10 }))
    .toThrow("크기를 바꾸면 맵을 가리키는 설정이 끊겨요.");
});

it("맵 이름과 배경 음악 하나를 바꾸고 나머지 제한과 타일은 보존한다", async () => {
  const project = blankProject();
  project.maps[firstId]!.disableEscape = true;
  await expectEdit(project, firstId, "map.properties.set", {
    name: "달빛 언덕", bgmResourceId: "cc0-bgm-field", disableSave: true,
  }, (after, before) => {
    expect(after.maps[firstId]).toEqual({ ...before.maps[firstId], name: "달빛 언덕",
      bgm: { mode: "custom", resourceId: "cc0-bgm-field" }, disableSave: true, disableEscape: true });
  });
});

it("이름 요청은 이름만 허용하며 타일셋 변경이 시작 칸을 막으면 거절한다", () => {
  const project = blankProject();
  project.startMapId = firstId;
  project.startPos = { x: 3, y: 4 };
  const map = project.maps[firstId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const blocked = { up: false, down: false, left: false, right: false };
  const id = "blocked-tileset";
  project.tilesets = { ...project.tilesets, [id]: { ...tileset, id, passability: tileset.passability.map(() => blocked) } };
  const target = mapTarget(project, firstId)!;
  const primitive = PRIMITIVES.find(row => row.id === "map.properties.set")!;
  const args = { name: "새 마을" };
  const scope = primitive.scope({ project, target }, args);
  expect(scope).toMatchObject({ fields: ["name"] });
  const changed = { ...project, maps: { ...project.maps, [firstId]: { ...map, ...args, bgm: { mode: "parent" } as const } } };
  expect(checkSmallTaskScope(project, changed, scope).ok).toBe(false);
  expect(() => run(project, firstId, primitive.id, { tilesetId: id })).toThrow(/게임 시작 칸/u);
  expect(run(project, secondId, primitive.id, { tilesetId: id }).maps[secondId]!.tilesetId).toBe(id);
});

it("조우표가 시작값을 저장하고 지정된 장소에서만 슬라임을 뽑는다", async () => {
  const map = built.maps[villageId]!;
  const location = map.locations!.find(row => row.id === "loc10")!;
  await expectEdit(built, villageId, "map.encounterTable.set", {
    entries: [{ troopId, conditions: { locationId: location.name } }], encounterRate: 30,
  }, after => {
    const edited = after.maps[villageId]!;
    expect(edited.encounterRate).toBe(30);
    expect(edited.encounterTable).toEqual([{ troopId, weight: 1, conditions: { locationId: location.id } }]);
    const session = startSession(after, 123);
    expect(pickEncounterTroopForMap(edited, session, location, () => 0, after)).toBe(troopId);
    expect(pickEncounterTroopForMap(edited, session, { x: 0, y: 0 }, () => 0, after)).toBeUndefined();
  });
});

it("게임의 새 세션이 선택한 맵과 칸에서 시작한다", async () => {
  await expectEdit(blankProject(), secondId, "map.startPosition.set", { x: 3, y: 4 }, after => {
    expect(after.startMapId).toBe(secondId);
    expect(after.startPos).toEqual({ x: 3, y: 4 });
    expect(startSession(after, 123)).toMatchObject({ currentMapId: secondId, x: 3, y: 4 });
  });
});

it("편의점 문을 미닫이로 저장하고 출입 이벤트는 그대로 둔다", async () => {
  const street = "map_mk_street";
  await expectEdit(maou, street, "map.door.set", { x: 2, y: 8, kind: "slide", width: 2, height: 2 }, (after, before) => {
    const map = after.maps[street]!;
    const door = map.doors!.find(row => row.x === 2)!;
    expect(door).toMatchObject({ x: 2, y: 7, w: 2, h: 2, style: "slide", hinge: "left" });
    expect(door.auto).toBeUndefined();
    expect(doorKindName(door)).toBe("slide");
    expect(map.events).toEqual(before.maps[street]!.events);
  });
  const quiet = run(maou, street, "map.door.set", { x: 2, y: 8, kind: "auto", chime: false });
  const beforeDoor = maou.maps[street]!.doors!.find(row => row.x === 2)!;
  const quietDoor = quiet.maps[street]!.doors!.find(row => row.x === 2)!;
  expect(beforeDoor.chimeSe).toBeDefined();
  expect(quietDoor.chimeSe).toBeUndefined();
  expect(quietDoor).toMatchObject({ auto: true, openSe: beforeDoor.openSe, closeSe: beforeDoor.closeSe });
});

it("선택 맵에서 새 연결을 저장하며 주민 경로가 그 연결을 사용한다", async () => {
  await expectEdit(blankProject(), firstId, "map.connection.upsert", {
    name: "나루 건너기", x: 2, y: 3, toMapId: secondId, toX: 4, toY: 5, toDirection: "down", npcEnabled: true,
  }, after => {
    const expected = {
      id: "connection_small_task_1", name: "나루 건너기",
      from: { mapId: firstId, x: 2, y: 3 }, to: { mapId: secondId, x: 4, y: 5, direction: "down" },
      playerEnabled: true, npcEnabled: true,
    };
    expect(after.mapConnections).toEqual([expected]);
    expect(firstConnectionToward(after.mapConnections!, firstId, secondId)).toEqual({ first: expected });
    const changed = run(after, firstId, "map.connection.upsert", {
      connectionId: expected.id, x: 2, y: 3, toMapId: secondId, toX: 6, toY: 5,
    });
    expect(changed.mapConnections).toEqual([{ ...expected, to: { ...expected.to, x: 6 } }]);
  });
});

it("이전 연결의 식별자에 공백이 있어도 다른 연결을 덮지 않는다", () => {
  const project = blankProject();
  const from = { mapId: firstId, x: 2, y: 3 };
  const to = { mapId: secondId, x: 4, y: 5 };
  const incoming = { id: "connection_one", from: to, to: from, playerEnabled: true, npcEnabled: false };
  const selected = { ...incoming, id: "connection_one ", from, to };
  project.mapConnections = [incoming, selected];
  const after = run(project, firstId, "map.connection.upsert", {
    connectionId: selected.id, x: 2, y: 3, toMapId: secondId, toX: 6, toY: 5,
  });
  expect(after.mapConnections).toEqual([incoming, { ...selected, to: { ...to, x: 6 } }]);
  expect(project.mapConnections).toEqual([incoming, selected]);
});

it("장소의 이름과 사각형, 메모와 태그를 한 행으로 저장한다", async () => {
  await expectEdit(blankProject(), firstId, "map.location.create", {
    name: "약초 쉼터", x: 2, y: 3, w: 3, h: 2, note: "쉼터 표시", tags: ["휴식"],
  }, after => {
    expect(after.maps[firstId]!.locations).toEqual([{ id: "loc1", name: "약초 쉼터", x: 2, y: 3, w: 3, h: 2,
      note: "쉼터 표시", tags: ["휴식"] }]);
  });
});

it("장소를 옮기거나 이름을 바꿔도 이벤트 조건은 같은 장소를 판정한다", async () => {
  const project = blankProject();
  project.maps[firstId]!.locations = [{ id: "loc1", name: "나무 그늘", x: 1, y: 1, w: 2, h: 2 }];
  const commands: Command[] = [{
    kind: "fork", condition: { kind: "insideLocation", locationId: "loc1", inside: true },
    then: [{ kind: "text", body: "쉼터 안" }], else: [{ kind: "text", body: "쉼터 밖" }],
  }];
  await expectEdit(project, firstId, "map.location.update", { locationId: "나무 그늘", name: "쉼터", x: 3, y: 4 }, after => {
    const map = after.maps[firstId]!;
    expect(map.locations).toEqual([{ id: "loc1", name: "쉼터", x: 3, y: 4, w: 2, h: 2 }]);
    expect(play(after, map, commands)).toMatchObject({ kind: "text", body: "쉼터 안" });
    expect(play(after, map, commands, 1, 1)).toMatchObject({ kind: "text", body: "쉼터 밖" });
  });
});

it("이름이 같은 식별자를 다른 맵이 써도 고른 맵의 장소 한 곳만 지운다", async () => {
  const project = blankProject();
  const location = { id: "loc1", name: "잔디밭", x: 1, y: 1, w: 3, h: 2 };
  project.maps[firstId]!.locations = [location];
  project.maps[secondId]!.locations = [{ ...location, name: "건너편 잔디밭" }];
  project.maps[secondId]!.encounterTable = [{ troopId, weight: 1, conditions: { locationId: "loc1" } }];
  await expectEdit(project, firstId, "map.location.delete", { locationId: "잔디밭" }, (after, before) => {
    expect(after.maps[firstId]!.locations ?? []).toEqual([]);
    expect(after.maps[secondId]).toEqual(before.maps[secondId]);
  });
});

it("다른 맵의 중첩 이동 이벤트와 연결 이름을 제시하며 맵 삭제를 거절한다", () => {
  const project = blankProject();
  const exit = transferEvent(secondId);
  project.maps[firstId]!.events = [{ ...exit, commands: [{ kind: "choices", options: [{ text: "건너기", branch: exit.commands }] }] }];
  const args = { name: "나루 통로", x: 2, y: 3, toMapId: secondId, toX: 3, toY: 4 };
  const after = run(project, firstId, "map.connection.upsert", args);
  expect(() => run(after, secondId, "map.structure.remove", {})).toThrow(/광장 정문.*나루 통로/u);
  expect(after.maps[secondId]).toBeDefined();
});

it("다른 맵의 연결을 덮거나 맵 밖 위치를 지정할 수 없다", () => {
  const project = blankProject();
  const args = { x: 2, y: 3, toMapId: secondId, toX: 3, toY: 4 };
  const linked = run(project, firstId, "map.connection.upsert", args);
  expect(() => run(linked, secondId, "map.connection.upsert", { ...args, connectionId: linked.mapConnections![0]!.id }))
    .toThrow(/범위 밖/u);
  expect(() => run(project, firstId, "map.door.set", { x: 19, y: 1, kind: "double", width: 2 })).toThrow(/범위 밖/u);
  expect(() => run(project, firstId, "map.startPosition.set", { x: 20, y: 0 })).toThrow(/범위 밖/u);
  expect(() => run(project, firstId, "map.location.create", { name: "낭떠러지", x: 19, y: 0, w: 2, h: 1 }))
    .toThrow(/범위 밖/u);
});

it("없는 배경 음악, 적 무리, 도착 맵과 참조가 남은 장소를 거절한다", () => {
  const project = blankProject();
  project.maps[firstId]!.locations = [{ id: "loc1", name: "작은 풀숲", x: 1, y: 1, w: 3, h: 2 }];
  project.maps[firstId]!.encounterTable = [{ troopId, weight: 1, conditions: { locationId: "loc1" } }];
  expect(() => run(project, firstId, "map.properties.set", { bgmResourceId: "missing_sound" })).toThrow(/음악/u);
  expect(() => run(project, firstId, "map.encounterTable.set", { entries: [{ troopId: "missing_troop" }] })).toThrow(/적 무리/u);
  expect(() => run(project, firstId, "map.connection.upsert", { x: 2, y: 3, toMapId: "missing_map", toX: 3, toY: 4 }))
    .toThrow(/도착 맵/u);
  expect(() => run(project, firstId, "map.location.delete", { locationId: "작은 풀숲" })).toThrow(/가리키는 조건/u);
});

it("고른 장소와 자료집 항목의 선택 범위를 섞을 수 없다", () => {
  const actor = built.database.actors[0]!;
  const target = dbTarget(built, "actors", actor.id)!;
  expect(() => runPrimitive(built, target, "map.structure.create", { name: "잘못 고른 곳" })).toThrow(/범위 밖/u);
  expect(() => run(built, villageId, "map.location.update", { locationId: "없는 광장", name: "작업실" })).toThrow(/찾을 수 없어요/u);
  expect(() => run(maou, "map_mk_street", "map.location.delete", { locationId: "이자카야 건물" })).toThrow(/장소가 여럿/u);
});

it("생성과 복제 범위는 선택 맵과 새 맵 사이에 연결을 몰래 추가할 수 없다", () => {
  const project = blankProject();
  const target = mapTarget(project, firstId)!;
  for (const id of ["map.structure.create", "map.structure.duplicate"]) {
    const args = { name: "복사 실험" };
    const primitive = PRIMITIVES.find(row => row.id === id)!;
    const after = run(project, firstId, id, args);
    const linked = run(after, firstId, "map.connection.upsert", { x: 0, y: 0, toMapId: newId, toX: 0, toY: 0 });
    expect(checkSmallTaskScope(project, linked, primitive.scope({ project, target }, args)).ok).toBe(false);
  }
});

it("선택한 맵 키와 맵의 식별자가 다르면 다른 맵에 쓰지 않는다", () => {
  const project = blankProject();
  const target = mapTarget(project, firstId)!;
  project.maps[firstId] = { ...project.maps[secondId]! };
  const before = structuredClone(project.maps);
  expect(() => runPrimitive(project, target, "map.properties.set", { name: "달빛 언덕" }))
    .toThrow(/선택한 맵을 찾을 수 없어요/u);
  expect(project.maps).toEqual(before);
});

it("등록된 배경만 저장하고 음악 리소스나 없는 그림을 배경으로 쓰지 않는다", () => {
  const project = blankProject();
  const after = run(project, firstId, "map.properties.set", { battleBackground: "backdrop:battle-scenery-forest" });
  expect(after.maps[firstId]!.battleBackground).toBe("battle-scenery-forest");
  expect(run(project, firstId, "map.properties.set", { battleBackground: "battle-scenery-field" }).maps[firstId]!.battleBackground)
    .toBe("battle-scenery-field");
  for (const input of [{ battleBackground: "missing-art" }, { backgroundImageId: "cc0-bgm-field" }, { backgroundImageId: "backdrop: " }]) {
    expect(() => run(project, firstId, "map.properties.set", input)).toThrow(/배경 그림을 찾을 수 없어요/u);
  }
  expect(() => run(project, firstId, "map.connection.upsert", {
    name: "  ", x: 2, y: 3, toMapId: secondId, toX: 3, toY: 4,
  })).toThrow(PrimitiveError);
});

it("새 배경 그림과 곡을 골라도 추가 배경 레이어와 음악 재생 설정은 보존한다", async () => {
  const project = blankProject();
  const map = project.maps[firstId]!;
  const layers = [{ imageId: "battle-scenery-forest", scrollX: 0.1 }];
  map.background = {
    imageId: "", fromMap: { mapId: secondId }, layers, fit: "cover", loopY: false,
  };
  map.bgm = { mode: "custom", resourceId: "cc0-bgm-field", fadeInMs: 250 };
  await expectEdit(project, firstId, "map.properties.set", {
    backgroundImageId: "battle-scenery-forest", bgmResourceId: "cc0-bgm-field",
  }, after => {
    expect(after.maps[firstId]!.background).toEqual({ imageId: "battle-scenery-forest", layers, fit: "cover", loopY: false });
    expect(after.maps[firstId]!.bgm).toEqual(map.bgm);
    expect(after.maps[secondId]).toBe(project.maps[secondId]);
  });
});

it("청사진의 이름 참조를 끊는 이름 변경을 거절한다", () => {
  const project = blankProject();
  project.gameBlueprint = {
    version: 1, title: "강 건너 이야기", genre: "모험", playerGoal: "강 건너 묵은 비밀을 찾는다",
    places: [{ name: "강 건너", kind: "village" }], steps: [], ending: { name: "귀환", how: "비밀을 푼다", feeling: "안도" },
  };
  const partialName = structuredClone(project);
  partialName.gameBlueprint!.places![0]!.name = "건너";
  expect(() => run(project, secondId, "map.properties.set", { name: "달빛 언덕" })).toThrow(/청사진/u);
  expect(() => run(partialName, firstId, "map.properties.set", { name: "건너" })).toThrow(/청사진/u);
  const renamed = run(partialName, firstId, "map.properties.set", { name: "달빛 언덕" });
  expect(renamed.gameBlueprint).toEqual(partialName.gameBlueprint);
  expect(renamed.maps[firstId]!.name).toBe("달빛 언덕");
});

it("하나의 문을 고르면 이웃 문과 겹치는 크기를 거절하고 기존 문 순서를 보존한다", async () => {
  const project = blankProject();
  const map = project.maps[firstId]!;
  const first = { x: 2, y: 3, w: 1, h: 1, style: "swing", hinge: "left" } as const;
  const next = { ...first, x: 3, openSe: "cc0-se-neighbor" };
  map.doors = [first, next];
  expect(() => run(project, firstId, "map.door.set", { x: 2, y: 3, kind: "slide", width: 2 }))
    .toThrow(/다른 문과 범위가 겹쳐요/u);
  await expectEdit(project, firstId, "map.door.set", { x: 2, y: 4, kind: "slide" }, changed => {
    expect(changed.maps[firstId]!.doors).toMatchObject([{ ...first, style: "slide" }, next]);
  });
  const removed = run(project, firstId, "map.door.set", { x: 2, y: 4, kind: "none" });
  expect(removed.maps[firstId]!.doors).toEqual([next]);
  expect(map.doors).toEqual([first, next]);
});

it("문 크기만 바꾸면 기존 문의 종류, 문틀과 배경은 보존한다", () => {
  const project = blankProject();
  const door = { x: 2, y: 3, w: 1, h: 1, style: "shutter", hinge: "left", interior: "none",
    frame: { l: 2, r: 3, t: 4, b: 0 }, openSe: "custom_open" } as const;
  project.maps[firstId]!.doors = [door];
  const after = run(project, firstId, "map.door.set", { x: 2, y: 3, height: 2 });
  expect(after.maps[firstId]!.doors).toEqual([{ ...door, y: 2, h: 2 }]);
  expect(() => run(project, firstId, "map.door.set", { x: 2, y: 3, chime: true })).toThrow(/자동문/u);
});

it("공간 설계에서 만든 출입구를 수정하거나 같은 칸에 연결을 겹치면 거절한다", () => {
  const project = blankProject();
  const document = geographyFixture("region").spatialAuthoring!;
  const root = own(document.occurrences, geographyRoot);
  const { from: target } = document.connections[0]!;
  const child = own(document.occurrences, target.occurrenceId);
  const id = "geography_enter", returnId = "geography_return";
  const from = { mapId: firstId, x: 2, y: 3 };
  const to = { mapId: secondId, x: 4, y: 5 };
  project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences,
    [root.id]: { ...root, bindings: [{
      mapId: from.mapId, rect: { x: 0, y: 0, width: 10, height: 8 }, eventIds: [id],
      connectionIds: [], ports: [], contentDigest: "0".repeat(64), overviewEntries: [
        { eventId: id, returnEventId: returnId, x: from.x, y: from.y, target },
      ],
    }] },
    [child.id]: { ...child, bindings: [{
      mapId: to.mapId, rect: { x: 0, y: 0, width: 10, height: 8 }, eventIds: [returnId],
      connectionIds: [], ports: [{ portId: target.portId, x: to.x, y: to.y }], contentDigest: "0".repeat(64),
    }] },
  } };
  project.mapConnections = [
    { id, from, to, playerEnabled: true, npcEnabled: true },
    { id: returnId, from: to, to: from, playerEnabled: true, npcEnabled: true },
  ];
  const args = { x: from.x, y: from.y, toMapId: to.mapId, toX: to.x, toY: to.y };
  expect(() => run(project, from.mapId, "map.connection.upsert", { ...args, connectionId: id, npcEnabled: false }))
    .toThrow(/공간 설계/u);
  expect(() => run(project, from.mapId, "map.connection.upsert", args)).toThrow(/공간 설계/u);
  expect(() => run(project, to.mapId, "map.connection.upsert", { x: to.x, y: to.y, toMapId: from.mapId, toX: from.x, toY: from.y }))
    .toThrow(/공간 설계/u);
  expect(run(project, from.mapId, "map.connection.upsert", { ...args, connectionId: id })).toBe(project);
  expect(run(project, from.mapId, "map.connection.upsert", { ...args, x: from.x + 1 }).mapConnections).toHaveLength(3);

  const manual = structuredClone(project);
  manual.mapConnections![0]!.id = "manual_connection";
  expect(() => run(manual, from.mapId, "map.connection.upsert", { ...args, x: from.x + 1, connectionId: "manual_connection" }))
    .toThrow(/공간 설계/u);
});

it.each(["필드 스폰", "경비 시야", "공용 이벤트", "전투 뒤 이벤트"])("장소를 사용하는 %s가 있으면 삭제를 거절한다", (site) => {
  const project = blankProject();
  const map = project.maps[firstId]!;
  const location = { id: "loc1", name: "쉼터", x: 1, y: 1, w: 3, h: 2 };
  map.locations = [location];
  const fork: Command = { kind: "fork", condition: { kind: "insideLocation", locationId: location.id, inside: true }, then: [] };
  const shop: Command = { kind: "shop", itemIds: [], failedTransactionBranch: [fork] };
  if (site === "필드 스폰") map.fieldSpawns = [{ id: "spawn_one", troopId, area: location, locationId: location.id }];
  if (site === "경비 시야") map.events = [{ ...transferEvent(secondId), condition: {
    kind: "not", condition: { kind: "eventSeesPlayer", eventId: "", watchers: { locationId: location.id } },
  } }];
  if (site === "공용 이벤트") project.commonEvents = [{ id: "common_test", name: "공용 안내", trigger: "none", commands: [shop] }];
  if (site === "전투 뒤 이벤트") {
    const troop = built.database.troops.find(row => row.id === troopId)!;
    project.database = { ...project.database, troops: [{ ...troop, afterBattle: { defeat: [shop] } }] };
  }
  expect(() => run(project, firstId, "map.location.delete", { locationId: location.id })).toThrow(/조건이나 설정/u);
  expect(map.locations).toEqual([location]);
});

it("같은 맵의 장소를 사용하는 새 이벤트 초안의 이름을 삭제 거절에 표시한다", () => {
  const project = blankProject();
  const location = { id: "loc1", name: "쉼터", x: 1, y: 1, w: 3, h: 2 };
  project.maps[firstId]!.locations = [location];
  project.maps[secondId]!.locations = [location];
  const original = { ...transferEvent(secondId), name: "미저장 경비" };
  const target = mapTarget(project, firstId)!;
  const remove = (draftMapId: string) => runPrimitive(project, target, "map.location.delete", { locationId: location.id }, undefined, {
    maps: { [draftMapId]: { events: [{ ...original, condition: { kind: "insideLocation", locationId: location.id, inside: true },
      draft: { kind: "new", original } }] } },
  }).after;
  expect(() => remove(firstId)).toThrow(/미저장 경비/u);
  expect(remove(secondId).maps[firstId]!.locations ?? []).toEqual([]);
  expect(project.maps[firstId]!.locations).toEqual([location]);
});

it("장소를 만들거나 이름을 바꿀 때 같은 이름과 식별자를 여러 곳에 쓰지 않는다", () => {
  const project = blankProject();
  project.maps[firstId]!.locations = [
    { id: "loc1", name: "나무 그늘", x: 1, y: 1, w: 2, h: 2 },
    { id: "loc2", name: "정문", x: 3, y: 1, w: 1, h: 1 },
  ];
  const duplicateIds = structuredClone(project);
  duplicateIds.maps[firstId]!.locations![1]!.id = "loc1";
  expect(() => run(project, firstId, "map.location.create", { name: "나무그늘", x: 1, y: 1, w: 1, h: 1 }))
    .toThrow(/구분할 수 있는 이름/u);
  expect(() => run(project, firstId, "map.location.update", { locationId: "loc2", name: "loc1" }))
    .toThrow(/구분할 수 있는 이름/u);
  expect(() => run(duplicateIds, firstId, "map.location.delete", { locationId: "정문" })).toThrow(/같은 식별자/u);
});

it("새 장소의 식별자가 기존 장소의 이름을 가리지 않는다", () => {
  const create = (project: Project, name: string) => run(project, firstId, "map.location.create", { name, x: 2, y: 2, w: 1, h: 1 });
  const project = create(create(blankProject(), "Lo c2"), "쉼터");
  expect(project.maps[firstId]!.locations).toMatchObject([{ id: "loc1" }, { id: "loc3" }]);
  const after = run(project, firstId, "map.location.update", { locationId: "loc2", name: "정문" });
  expect(after.maps[firstId]!.locations).toMatchObject([{ name: "정문" }, { name: "쉼터" }]);
});

it("다른 맵의 NPC 경로와 전투 뒤 파티 위치가 삭제·축소할 맵을 계속 가리키면 거절한다", () => {
  const project = blankProject();
  project.maps[firstId]!.events = [{ ...transferEvent(firstId), moveRoute: {
    repeat: false, moves: [{ kind: "npcTransfer", mapId: secondId, x: 9, y: 4 }],
  } }];
  const troop = built.database.troops.find(row => row.id === troopId)!;
  project.database = { ...project.database, troops: [{ ...troop, name: "슬라임 부대", afterBattle: {
    escape: [{ kind: "storeParty", partySetId: "party_test", mapId: secondId, x: 9, y: 4 }],
  } }] };
  expect(() => run(project, secondId, "map.structure.remove", {})).toThrow(/슬라임 부대.*광장 정문/u);
  expect(() => run(project, secondId, "map.structure.resize", { width: 9 })).toThrow(/기존 영역이 맵 밖/u);
  expect(project.maps[secondId]).toMatchObject({ width: 12, height: 10 });
});

it("퀘스트의 중첩 목적지가 가리키는 맵과 장소를 보존한다", () => {
  const project = blankProject();
  const map = project.maps[secondId]!;
  map.locations = [{ id: "loc1", name: "건너편 약초밭", x: 2, y: 1, w: 2, h: 2 }];
  project.maps[firstId]!.locations = [{ ...map.locations[0]!, name: "이쪽 약초밭" }];
  project.quests = [{
    key: "find_herb", title: "약초 찾기", summary: "건너편에서 약초를 찾는다",
    giver: { create: { mapId: firstId, x: 1, y: 1, name: "약초꾼" } },
    steps: [{ kind: "collect", itemId: "item_herb", count: 1,
      sources: [{ kind: "pickup", mapId: secondId, x: 9, y: 3, locationId: "loc1" }] }],
  }];
  expect(() => run(project, secondId, "map.structure.remove", {})).toThrow(/사용하는 퀘스트/u);
  expect(() => run(project, secondId, "map.structure.resize", { width: 9 })).toThrow(/기존 영역이 맵 밖/u);
  expect(() => run(project, secondId, "map.location.delete", { locationId: "loc1" })).toThrow(/조건이나 설정/u);
  expect(run(project, firstId, "map.location.delete", { locationId: "loc1" }).maps[firstId]!.locations ?? []).toEqual([]);
  const renamed = run(project, secondId, "map.location.update", { locationId: "loc1", name: "큰 약초밭" });
  expect(renamed.maps[secondId]!.locations?.[0]).toMatchObject({ id: "loc1", name: "큰 약초밭" });
  expect(renamed.quests).toBe(project.quests);
});

it("공백이 있는 예전 장소 식별자가 같은 이름의 장소에 연결되지 않는다", () => {
  const project: Project = { ...built, maps: { ...built.maps } };
  const map = { ...built.maps[villageId]!, locations: [
    { id: "loc1", name: "광장", x: 1, y: 1, w: 2, h: 2 },
    { id: "loc1 ", name: "나루", x: 5, y: 5, w: 2, h: 2 },
  ] };
  project.maps[villageId] = map;
  const after = run(project, villageId, "map.encounterTable.set", { entries: [{ troopId, conditions: { locationId: "loc1 " } }] });
  expect(after.maps[villageId]!.encounterTable?.[0]?.conditions?.locationId).toBe("loc1 ");
  const unconditional = run(project, villageId, "map.encounterTable.set", { entries: [{ troopId }] });
  expect(unconditional.maps[villageId]!.encounterTable).toEqual([{ troopId, weight: 1 }]);
  expect(run(project, villageId, "map.location.update", { locationId: "loc1 ", name: "동쪽 나루" })
    .maps[villageId]!.locations).toEqual([map.locations[0], { ...map.locations[1], name: "동쪽 나루" }]);
});

it("삭제할 맵에만 있는 이벤트의 셀프 스위치 시작값을 보존한다", () => {
  const project = blankProject();
  const event = transferEvent(firstId);
  project.maps[secondId]!.events = [event];
  project.session = { ...project.session, selfSwitches: { [event.id]: { A: true } } };
  expect(() => run(project, secondId, "map.structure.remove", {})).toThrow(/이벤트에 시작 상태/u);
  expect(project.maps[secondId]!.events).toEqual([event]);
  expect(project.session.selfSwitches).toEqual({ [event.id]: { A: true } });
});

it("축소가 필드 스폰을 자르면 거절하고, 참조 없는 맵의 구조 변환은 선택 맵에만 적용한다", () => {
  const project = blankProject();
  const map = project.maps[secondId]!;
  const withSpawn = blankProject();
  withSpawn.maps[secondId]!.fieldSpawns = [{ id: "spawn_one", troopId, area: { x: 9, y: 2, w: 2, h: 2 } }];
  expect(() => run(withSpawn, secondId, "map.structure.resize", { width: 10 })).toThrow(/기존 영역이 맵 밖/u);
  const resized = run(project, secondId, "map.structure.resize", { width: 13 });
  expect(resized.maps[firstId]).toBe(project.maps[firstId]);
  expect(resized.maps[secondId]!.lowerTiles).toHaveLength(130);
  const removed = run(project, secondId, "map.structure.remove", {});
  expect(removed.maps).toEqual({ [firstId]: project.maps[firstId] });
  expect(removed.mapTree).toEqual({ mapId: firstId, children: [] });
  expect(project.maps[secondId]).toBe(map);
});
