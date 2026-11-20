/** @vitest-environment happy-dom */
import { beforeAll, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/23-map-structure";
import { dbTarget, mapTarget } from "@/editor/smallTask/target";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { pickEncounterTroopForMap } from "@/player/encounters";
import { createInterpreter } from "@/player/interpreter";
import { firstConnectionToward } from "@/player/npcLivingTravel";
import { doorKindName } from "@/project/eventCommands/doorAnimation";
import { startSession } from "@/project/session";
import type { Command, GameMap, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
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
}, 240_000);

function blankProject() {
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
