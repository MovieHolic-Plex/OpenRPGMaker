/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { enemyBattlers } from "@/battle/battleBattlers";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { collectBattleRewards } from "@/battle/battleRewards";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/20-db-enemies-troops";
import { createInterpreter } from "@/player/interpreter";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeTerrainRecords } from "@/project/databaseUtilityRecordModel";
import { terrainRecordAt } from "@/project/terrainAt";
import { scaledEncounterRate } from "@/project/terrainStep";
import type { Command, CommonEvent, Project, TroopRecord } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { dbTarget as select, expectApplies, expectRefused, expectUndoRestores, loadFixture } from "./harness";

type Collection = "enemies" | "troops" | "terrains" | "battleCommands";
type Rows = NonNullable<Project["database"][Collection]>;
type Case = {
  id: string;
  fixture: "blank" | "built" | "maou";
  collection: Collection;
  targetId: string;
  args: Record<string, unknown>;
  prepare?: (project: Project) => Project;
  expected: (project: Project) => Rows;
  sentence: string;
};

const fixtures = new Map<Case["fixture"], Project>();
function fixtureProject(fixture: Case["fixture"]): Project {
  const cached = fixtures.get(fixture);
  if (cached) return cached;
  const project = loadFixture(fixture);
  fixtures.set(fixture, project);
  return project;
}

function editRow<T extends { id: string }>(rows: readonly T[], id: string, edit: (row: T) => T): T[] {
  return rows.map(row => row.id === id ? edit(row) : row);
}

function unusedTerrain(project: Project): Project {
  const terrain = normalizeTerrainRecords([{ id: "terrain_spare", name: "여분 지형" }])[0]!;
  return {
    ...project,
    database: { ...project.database, terrains: [...project.database.terrains!, terrain] },
    tilesets: Object.fromEntries(Object.entries(project.tilesets).map(([id, tileset]) => [id, {
      ...tileset,
      terrain: tileset.terrain.map(tag => tag >= 5 ? 0 : tag),
      tileMeta: tileset.tileMeta?.map(meta => (meta.terrainTag ?? 0) >= 5 ? { ...meta, terrainTag: 0 } : meta),
    }])),
  };
}

const cases: readonly Case[] = [
  {
    id: "db.enemies.create", fixture: "built", collection: "enemies", targetId: "enemy_slime",
    args: { name: "이끼 괴물", maxHp: 180, exp: 41 },
    expected: project => [...project.database.enemies, {
      ...normalizeEnemyRecord({ id: "enemy_small_1", name: "이끼 괴물" }),
      stats: { maxHp: 180, maxMp: 0, attack: 10, defense: 10, mind: 10, agility: 10 },
      rewards: { exp: 41, gold: 0, dropRatePercent: 0 },
    }],
    sentence: "적 「이끼 괴물」 항목을 추가했어요.",
  },
  {
    id: "db.enemies.update", fixture: "maou", collection: "enemies", targetId: "enemy_mk_leon_castle",
    args: { maxHp: 1_800, exp: 500 },
    expected: project => editRow(project.database.enemies, "enemy_mk_leon_castle", row => ({
      ...row, stats: { ...row.stats, maxHp: 1_800 }, rewards: { ...row.rewards, exp: 500 },
    })),
    sentence: "적 「용사 레온」 항목을 수정했어요.",
  },
  {
    id: "db.enemies.delete", fixture: "built", collection: "enemies", targetId: "enemy_slime_blue", args: {},
    expected: project => project.database.enemies.filter(row => row.id !== "enemy_slime_blue"),
    sentence: "적 「푸른 슬라임」 항목을 삭제했어요.",
  },
  {
    id: "db.troops.create", fixture: "built", collection: "troops", targetId: "troop_slime",
    args: { name: "슬라임 셋", members: [{ enemyId: "enemy_slime", x: 70, y: 88 }, { enemyId: "enemy_slime" }, { enemyId: "enemy_slime", hidden: true }] },
    expected: project => [...project.database.troops, {
      ...normalizeTroopRecord({ id: "troop_small_1", name: "슬라임 셋" }),
      enemyIds: ["enemy_slime", "enemy_slime", "enemy_slime"],
      members: [
        { enemyId: "enemy_slime", x: 70, y: 88, hidden: false },
        { enemyId: "enemy_slime", x: 160, y: 96, hidden: false },
        { enemyId: "enemy_slime", x: 216, y: 96, hidden: true },
      ], autoAlign: false,
    }],
    sentence: "적 무리 「슬라임 셋」 항목을 추가했어요.",
  },
  {
    id: "db.troops.update", fixture: "maou", collection: "troops", targetId: "troop_mk_power",
    args: { memberNumber: 1, x: 82, y: 119 },
    expected: project => editRow(project.database.troops, "troop_mk_power", row => ({
      ...row, autoAlign: false,
      enemyIds: row.enemyIds.slice(),
      members: row.members!.map((member, i) => i === 0 ? { ...member, x: 82, y: 119 } : member),
    })),
    sentence: "적 무리 「편의점의 결전 · 마왕 재림」 항목을 수정했어요.",
  },
  {
    id: "db.troops.delete", fixture: "built", collection: "troops", targetId: "troop_bat_swarm", args: {},
    expected: project => project.database.troops.filter(row => row.id !== "troop_bat_swarm"),
    sentence: "적 무리 「동굴 박쥐 떼」 항목을 삭제했어요.",
  },
  {
    id: "db.terrains.create", fixture: "blank", collection: "terrains", targetId: "terrain_water",
    args: { name: "끓는 진흙", damage: 12, encounterRatePercent: 75, raft: false },
    expected: project => [...project.database.terrains!, {
      id: "terrain_small_1", name: "끓는 진흙", damage: 12, encounterRatePercent: 75, characterDisplay: "normal",
      vehiclePassage: { boat: false, ship: false, airshipLand: true, raft: false },
    }],
    sentence: "지형 「끓는 진흙」 항목을 추가했어요.",
  },
  {
    id: "db.terrains.update", fixture: "blank", collection: "terrains", targetId: "terrain_water",
    args: { encounterRatePercent: 0, damage: 7, raft: false },
    expected: project => editRow(project.database.terrains!, "terrain_water", row => ({
      ...row, damage: 7, encounterRatePercent: 0, vehiclePassage: { ...row.vehiclePassage, raft: false },
    })),
    sentence: "지형 「물」 항목을 수정했어요.",
  },
  {
    id: "db.terrains.delete", fixture: "blank", collection: "terrains", targetId: "terrain_spare", args: {},
    prepare: unusedTerrain,
    expected: project => project.database.terrains!.filter(row => row.id !== "terrain_spare"),
    sentence: "지형 「여분 지형」 항목을 삭제했어요.",
  },
  {
    id: "db.battleCommands.create", fixture: "blank", collection: "battleCommands", targetId: "cmd_attack",
    args: { name: "몸 지키기", kind: "defend" },
    expected: project => [...project.database.battleCommands!, { id: "cmd_small_1", name: "몸 지키기", kind: "defend" }],
    sentence: "전투 명령 「몸 지키기」 항목을 추가했어요.",
  },
  {
    id: "db.battleCommands.update", fixture: "built", collection: "battleCommands", targetId: "cmd_skill",
    args: { name: "불꽃 던지기", skillId: "skill_fire" },
    expected: project => editRow(project.database.battleCommands!, "cmd_skill", row => ({
      ...row, name: "불꽃 던지기", skillId: "skill_fire",
    })),
    sentence: "전투 명령 「불꽃 던지기」 항목을 수정했어요.",
  },
  {
    id: "db.battleCommands.delete", fixture: "built", collection: "battleCommands", targetId: "cmd_defend", args: {},
    expected: project => project.database.battleCommands!.filter(row => row.id !== "cmd_defend"),
    sentence: "전투 명령 「방어」 항목을 삭제했어요.",
  },
];

it.each(cases)("$id 저장값, 요약, 범위와 한 번 되돌리기", async testCase => {
  const { id, fixture, collection, targetId, args, prepare, expected, sentence } = testCase;
  const seed = fixtureProject(fixture);
  const before = prepare?.(seed) ?? seed;
  const target = select(before, collection, targetId);
  const primitive = PRIMITIVES.find(row => row.id === id)!;
  const originalRows = structuredClone(before.database[collection]);
  const expectedRows = expected(before);
  const { after, sentence: preview } = expectApplies(before, target, id, args);
  expect(after.database[collection]).toEqual(expectedRows);
  expect(before.database[collection]).toEqual(originalRows);
  expect(jsonEqual(after, { ...before, database: { ...before.database, [collection]: expectedRows } })).toBe(true);
  expect(preview).toBe(sentence);

  const scope = primitive.scope({ project: before, target }, args);
  const outside = checkSmallTaskScope(before, { ...after, meta: { ...after.meta, title: "범위 밖 변경" } }, scope);
  expect(outside).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  const other = collection === "terrains" ? select(before, "battleCommands", "cmd_attack") : select(before, "terrains", "terrain_water");
  expectRefused(before, other, id, args);
  await expectUndoRestores(before, after, target);
}, 180_000);

it.each([
  ["enemies", "enemy_slime", "update", { dropItemId: "item_missing_here" }, "아이템"],
  ["enemies", "enemy_slime", "create", { name: "적", monsterResourceId: "missing-monster-art" }, "소재"],
  ["enemies", "enemy_slime", "update", { maxHp: 0 }, /[가-힣]/u],
  ["enemies", "enemy_slime", "delete", {}, "사용 중"],
  ["troops", "troop_bat_swarm", "create", { name: "무리", members: [{ enemyId: "enemy_missing_here" }] }, "넣을 적"],
  ["troops", "troop_bat_swarm", "update", { members: [{ enemyId: "enemy_cave_bat", y: 241 }] }, /[가-힣]/u],
  ["troops", "troop_bat_swarm", "update", { memberNumber: 4, x: 80 }, "순서"],
  ["troops", "troop_slime", "delete", {}, "사용 중"],
  ["terrains", "terrain_sand", "create", { name: "동굴", footstepSoundResourceId: "missing-footsteps" }, "발소리"],
  ["terrains", "terrain_sand", "update", { battleBackgroundResourceId: "missing-battle-background" }, "배경"],
  ["terrains", "terrain_water", "delete", {}, "연결된 지형"],
  ["battleCommands", "cmd_attack", "create", { name: "불 마법", kind: "skill", skillId: "skill_missing_here" }, "기술"],
  ["battleCommands", "cmd_attack", "update", { kind: "commonEvent", commonEventId: "common_missing_here" }, "공통 이벤트"],
] as const)("%s %s %s 잘못된 값이나 참조 거절", (collection, id, action, args, reason) => {
  const project = fixtureProject("built");
  expect(() => runPrimitive(project, select(project, collection, id), `db.${collection}.${action}`, args)).toThrow(reason);
});

it("옛 적 무리를 편집할 때 전투 페이지와 전투 뒤 명령을 그대로 보존한다", () => {
  const seed = fixtureProject("built");
  const id = "troop_bat_swarm";
  const battleEventPages: TroopRecord["battleEventPages"] = [{
    id: "page_keep", name: "유지할 페이지", span: "battle", conditions: [], commands: [{ kind: "text", body: "원래 대사" }],
  }];
  const afterBattle: TroopRecord["afterBattle"] = { victory: [{ kind: "text", body: "전투 뒤 대사" }] };
  const database = { ...seed.database, troops: editRow(seed.database.troops, id, troop => ({
    ...troop, battleEventPages, afterBattle, members: undefined,
  })) };
  const project = { ...seed, database };
  const { after } = runPrimitive(project, select(project, "troops", id), "db.troops.update", { memberNumber: 2, x: 92 });
  const edited = after.database.troops.find(row => row.id === id)!;
  expect(edited.members?.[1]).toEqual({ enemyId: "enemy_cave_bat", x: 92, y: 88, hidden: false });
  expect(edited.members?.[0]).toEqual({ enemyId: "enemy_cave_bat", x: 84, y: 52, hidden: false });
  expect(edited.battleEventPages).toBe(battleEventPages);
  expect(edited.afterBattle).toBe(afterBattle);
});

it("카탈로그 명령을 배우 고유 목록이 쓰면 삭제를 거절한다", () => {
  const seed = fixtureProject("built");
  const database = { ...seed.database, actors: seed.database.actors.map((row, i) => i === 0 ? {
    ...row, battleCommandIds: ["cmd_defend"],
  } : row) };
  const project = { ...seed, database };
  expect(() => runPrimitive(project, select(project, "battleCommands", "cmd_defend"), "db.battleCommands.delete", {})).toThrow("사용 중");
});

function openBattle(project: Project, troopId: string) {
  const command: Command = { kind: "battleProcessing", troopId, canEscape: false, canLose: true };
  const step = createInterpreter([command], structuredClone(project.session), project).start();
  expect(step).toMatchObject({ kind: "battleProcessing", troopId });
  return enemyBattlers(project, project.database.troops.find(row => row.id === troopId)!);
}

it("이벤트 전투에서 조정한 최대 체력과 확정 전리품이 적용된다", () => {
  const before = fixtureProject("built");
  const { after } = runPrimitive(before, select(before, "enemies", "enemy_slime"), "db.enemies.update", {
    maxHp: 66, exp: 500, gold: 19, dropItemId: "item_potion", dropRatePercent: 100,
  });
  const battlers = openBattle(after, "troop_slime");
  expect(battlers).toMatchObject([{ hp: 66, maxHp: 66 }]);
  expect(collectBattleRewards(after, battlers, () => 0.5)).toMatchObject({ exp: 500, gold: 19, items: ["item_potion"] });
});

it("이벤트 전투에서 새 무리의 중복 적과 숨김·위치를 읽는다", () => {
  const before = fixtureProject("built");
  const { after } = runPrimitive(before, select(before, "troops", "troop_slime"), "db.troops.create", {
    name: "매복대", members: [{ enemyId: "enemy_slime", x: 75, y: 91 }, { enemyId: "enemy_slime", x: 112, y: 124, hidden: true }],
  });
  expect(openBattle(after, after.database.troops.at(-1)!.id)).toMatchObject([
    { recordId: "enemy_slime", battleX: 75, battleY: 91, hidden: false },
    { recordId: "enemy_slime", battleX: 112, battleY: 124, hidden: true },
  ]);
});

it("밟은 타일의 기존 지형 태그가 바뀐 피해와 조우율을 읽는다", () => {
  const seed = fixtureProject("built");
  const mapId = seed.startMapId;
  const map = seed.maps[mapId]!;
  const tile = map.lowerTiles.find(index => index >= 0)!;
  const tileset = seed.tilesets[map.tilesetId]!;
  const terrain = tileset.terrain.slice();
  const tileMeta = tileset.tileMeta?.slice();
  terrain[tile] = 1;
  if (tileMeta?.[tile]) tileMeta[tile] = { ...tileMeta[tile], terrainTag: 1 };
  const project = {
    ...seed, tilesets: { ...seed.tilesets, [tileset.id]: { ...tileset, terrain, tileMeta } },
    maps: { ...seed.maps, [mapId]: { ...map, lowerTiles: [tile, ...map.lowerTiles.slice(1)] } },
  };
  const { after } = runPrimitive(project, select(project, "terrains", "terrain_water"), "db.terrains.update", {
    damage: 7, encounterRatePercent: 50,
  });
  const at = terrainRecordAt(after, { mapId, x: 0, y: 0 })!;
  expect(at.record.damage).toBe(7);
  expect(scaledEncounterRate(20, at.record.encounterRatePercent)).toBe(10);
});

it("새 전투 명령에 연결한 공통 이벤트가 실행되어 스위치를 켠다", () => {
  const seed = fixtureProject("built");
  const actor = seed.database.actors[0]!;
  const switchId = seed.switches[0]!.id;
  const commonEvent: CommonEvent = {
    id: "common_test_battle", name: "신호", trigger: "none",
    commands: [{ kind: "setSwitch", switchId, value: true }],
  };
  const project = { ...seed, commonEvents: [...seed.commonEvents, commonEvent] };
  const { after } = runPrimitive(project, select(project, "battleCommands", "cmd_attack"), "db.battleCommands.create", {
    name: "신호 보내기", kind: "commonEvent", commonEventId: commonEvent.id,
  });
  const catalog = after.database.battleCommands!.at(-1)!;
  const menu = battleCommandsForActor(after, actor.id, { overrideCommandIds: [catalog.id] });
  expect(menu).toMatchObject([{ name: "신호 보내기", commonEventId: commonEvent.id }]);
  const session = structuredClone(after.session);
  session.switches[switchId] = false;
  expect(createInterpreter([{ kind: "callCommonEvent", commonEventId: menu[0]!.commonEventId! }], session, after).start()).toEqual({ kind: "done" });
  expect(session.switches[switchId]).toBe(true);
});

it("지우는 지형에 태그가 없어도 뒤 행을 가리키는 태그를 보호한다", () => {
  const seed = fixtureProject("blank");
  const tileset = Object.values(seed.tilesets)[0]!;
  const project = { ...seed, tilesets: { [tileset.id]: { ...tileset, terrain: [2], tileMeta: undefined } } };
  const target = select(project, "terrains", "terrain_water");
  expect(() => runPrimitive(project, target, "db.terrains.delete", {})).toThrow("연결된 지형");
});

it("사용 중인 식별자를 건너뛰고 새 명령만 자료집 끝에 붙인다", () => {
  const seed = fixtureProject("built");
  const database = { ...seed.database, actors: seed.database.actors.map((row, i) => i === 0 ? {
    ...row, battleCommandIds: ["cmd_small_1"],
  } : row) };
  const project = { ...seed, database };
  const target = select(project, "battleCommands", "cmd_attack");
  const { after } = runPrimitive(project, target, "db.battleCommands.create", { name: "새 기술", kind: "skill" });
  expect(after.database.battleCommands?.at(-1)).toMatchObject({ id: "cmd_small_2", name: "새 기술" });
  expect(after.database.actors).toBe(project.database.actors);
});
