/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { enemyBattlers } from "@/battle/battleBattlers";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { collectBattleRewards } from "@/battle/battleRewards";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import { plainSummary } from "@/editor/smallTask/plainSummary";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/20-db-enemies-troops";
import { setLocale, t } from "@/i18n";
import { createInterpreter } from "@/player/interpreter";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeTerrainRecords } from "@/project/databaseUtilityRecordModel";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { terrainRecordAt } from "@/project/terrainAt";
import { scaledEncounterRate } from "@/project/terrainStep";
import type { Command, CommonEvent, GameEvent, Project, TroopRecord } from "@/project/types";
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
  const seed = loadFixture(fixture);
  const project: Project = {
    ...seed,
    switches: [...seed.switches],
    variables: [...seed.variables],
    session: {
      ...seed.session,
      switches: { ...seed.session.switches },
      variables: { ...seed.session.variables },
    },
  };
  // Match store initialization before the primitive freezes its baseline.
  ensureSwitchVariableSlots(project);
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
  const rows = after.database[collection]!;
  const sibling = rows.find(row => row.id !== targetId && originalRows?.some(original => original.id === row.id))!;
  const changedSibling = { ...after, database: {
    ...after.database, [collection]: rows.map(row => row === sibling ? { ...row, name: "다른 항목" } : row),
  } };
  expect(checkSmallTaskScope(before, changedSibling, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  const other = collection === "terrains" ? select(before, "battleCommands", "cmd_attack") : select(before, "terrains", "terrain_water");
  expectRefused(before, other, id, args);
  await expectUndoRestores(before, after, target);
}, 180_000);

it.each([
  ["enemies", "enemy_slime", "update", { dropItemId: "item_missing_here" }, "아이템"],
  ["enemies", "enemy_slime", "create", { name: "적", monsterResourceId: "missing-monster-art" }, "소재"],
  ["enemies", "enemy_slime", "update", { maxHp: 0 }, /[가-힣]/u],
  ["enemies", "enemy_slime", "update", { name: "  " }, "빈 이름"],
  ["enemies", "enemy_slime", "delete", {}, "사용 중"],
  ["troops", "troop_bat_swarm", "create", { name: "무리", members: [{ enemyId: "enemy_missing_here" }] }, "넣을 적"],
  ["troops", "troop_bat_swarm", "update", { members: [{ enemyId: "enemy_cave_bat", y: 241 }] }, /[가-힣]/u],
  ["troops", "troop_bat_swarm", "update", { memberNumber: 1, x: 180, y: 100 }, "형식"],
  ["troops", "troop_bat_swarm", "create", { name: "무리", members: [{ enemyId: "enemy_slime", x: 180 }] }, "형식"],
  ["troops", "troop_bat_swarm", "update", { memberNumber: 4, x: 80 }, "순서"],
  ["troops", "troop_bat_swarm", "update", { memberNumber: 1, x: 80, autoAlign: true }, "자동 배치"],
  ["troops", "troop_bat_swarm", "update", { memberNumber: 1, members: [{ enemyId: "enemy_slime" }], x: 80 }, "명단"],
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

it("처음 선택했던 항목이 사라지면 같은 위치의 다른 항목을 수정하지 않는다", () => {
  const before = fixtureProject("built");
  const id = "enemy_slime_blue";
  const target = select(before, "enemies", id);
  const { after } = runPrimitive(before, target, "db.enemies.delete", {});
  expectRefused(after, target, "db.enemies.update", { maxHp: 600 }, /선택한 자료집 항목을 찾을 수 없어요/u);
});

it("적 이름을 바꿔도 기존 무리의 적 식별자와 전투 연결을 유지한다", () => {
  const before = fixtureProject("built");
  const target = select(before, "enemies", "enemy_slime");
  const { after } = runPrimitive(before, target, "db.enemies.update", { name: "새 슬라임" });
  expect(after.database.troops).toBe(before.database.troops);
  expect(after.maps).toBe(before.maps);
  expect(openBattle(after, "troop_slime")).toMatchObject([{ recordId: "enemy_slime", name: "새 슬라임" }]);
});

it("존재하는 소재라도 적 그림·전투 배경·발소리 종류를 구분한다", () => {
  const seed = fixtureProject("built");
  const picture = { id: "test-enemy", name: "검수용 적 그림", kind: "monster", dataUrl: "", meta: {} } as const;
  const sound = { id: "test-step", name: "검수용 발소리", kind: "sound", dataUrl: "", meta: {} } as const;
  const project = { ...seed, assets: { ...seed.assets, uploaded: { ...seed.assets.uploaded, [picture.id]: picture, [sound.id]: sound } } };
  const enemy = select(project, "enemies", "enemy_slime");
  const terrain = select(project, "terrains", "terrain_water");
  expectRefused(project, enemy, "db.enemies.update", { monsterResourceId: sound.id }, /적 그림/u);
  expectRefused(project, terrain, "db.terrains.update", { battleBackgroundResourceId: sound.id }, /전투 배경/u);
  expectRefused(project, terrain, "db.terrains.update", { footstepSoundResourceId: picture.id }, /발소리/u);
  const { after } = runPrimitive(project, terrain, "db.terrains.update", {
    battleBackgroundResourceId: "battle-scenery-field", footstepSoundResourceId: sound.id,
  });
  expect(after.database.terrains?.find(row => row.id === "terrain_water")).toMatchObject({
    battleBackgroundResourceId: "battle-scenery-field", footstepSoundResourceId: sound.id,
  });
  expect(runPrimitive(project, enemy, "db.enemies.update", { monsterResourceId: picture.id })
    .after.database.enemies.find(row => row.id === "enemy_slime")?.monsterResourceId).toBe(picture.id);
});

it("걷는 탈것과 수레의 추가 통행을 끄면 저장 형식을 유지한다", () => {
  const project = fixtureProject("built");
  const target = select(project, "terrains", "terrain_water");
  const { after: enabled } = runPrimitive(project, target, "db.terrains.update", { chocobo: true, cart: true, raft: false });
  const { after } = runPrimitive(enabled, target, "db.terrains.update", { chocobo: false, cart: false });
  const row = after.database.terrains!.find(entry => entry.id === "terrain_water")!;
  expect(row.vehiclePassage).not.toHaveProperty("chocobo");
  expect(row.vehiclePassage).not.toHaveProperty("cart");
  expect(row.vehiclePassage.raft).toBe(false);
  expect(jsonEqual(row, normalizeTerrainRecords([row])[0])).toBe(true);
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

it("공통 이벤트의 중첩된 명령이 쉼표로 기록한 전투 명령을 삭제할 수 없다", () => {
  const seed = fixtureProject("built");
  const switchId = seed.switches[0]!.id;
  const commonEvent: CommonEvent = {
    id: "common_battle_menu", name: "전투 메뉴", trigger: "none",
    commands: [{
      kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [],
      else: [{
        kind: "m2Command", commandId: "m2-092-change-battle-commands",
        fields: { target: "party", operation: "set", slots: "cmd_attack, cmd_defend , cmd_small_1" },
      }],
    }],
  };
  const project = { ...seed, commonEvents: [...seed.commonEvents, commonEvent] };
  const target = select(project, "battleCommands", "cmd_defend");
  expectRefused(project, target, "db.battleCommands.delete", {}, /사용 중/u);
  const { after } = runPrimitive(project, target, "db.battleCommands.create", { name: "새 명령" });
  expect(after.database.battleCommands?.at(-1)?.id).toBe("cmd_small_2");
});

it("장비가 사용하던 전투 명령 값을 카탈로그에서 상속할 때만 삭제를 거절한다", () => {
  const seed = fixtureProject("built");
  const [firstEquipment] = seed.database.equipment;
  const id = "cmd_defend";
  const database = {
    ...seed.database,
    battleCommands: editRow(seed.database.battleCommands!, id, command => ({ ...command, skillId: "skill_fire" })),
    classes: seed.database.classes.map(klass => ({
      ...klass, battleCommands: klass.battleCommands.map(command => command.id === id ? { ...command, skillId: "skill_fire" } : command),
    })),
    equipment: editRow(seed.database.equipment, firstEquipment!.id, equipment => ({
      ...equipment, grantsCommand: { id, name: "불꽃", kind: "skill" as const },
    })),
  };
  const project = { ...seed, database };
  const target = select(project, "battleCommands", id);
  expectRefused(project, target, "db.battleCommands.delete", {}, /사용 중/u);

  const independent = { ...project, database: {
    ...database,
    equipment: editRow(database.equipment, firstEquipment!.id, equipment => ({
      ...equipment, grantsCommand: { ...equipment.grantsCommand!, skillId: "skill_fire" },
    })),
  } };
  const { after } = runPrimitive(independent, target, "db.battleCommands.delete", {});
  expect(after.database.battleCommands?.some(command => command.id === id)).toBe(false);
  expect(after.database.equipment).toBe(independent.database.equipment);
});

it("슬롯 번호가 남아 있어도 전투 조건이 가리키는 적을 바꾸지 않는다", () => {
  const seed = fixtureProject("built");
  const id = "troop_bat_swarm";
  const battleEventPages: TroopRecord["battleEventPages"] = [{
    id: "page_hp", name: "첫째 적의 체력이 반 이하일 때", span: "battle",
    conditions: [{ kind: "enemyHpBelow", enemyId: "enemy-1", percent: 50 }], commands: [],
  }];
  const project = { ...seed, database: {
    ...seed.database, troops: editRow(seed.database.troops, id, troop => ({ ...troop, battleEventPages })),
  } };
  const target = select(project, "troops", id);
  expectRefused(project, target, "db.troops.update", {
    members: [{ enemyId: "enemy_slime" }, { enemyId: "enemy_cave_bat" }],
  }, /전투 조건/u);
  const { after } = runPrimitive(project, target, "db.troops.update", {
    members: [{ enemyId: "enemy_cave_bat" }, { enemyId: "enemy_slime" }],
  });
  expect(after.database.troops.find(troop => troop.id === id)?.battleEventPages).toBe(battleEventPages);
});

it.each([
  {
    conditions: [{ kind: "enemyHpBelow", enemyId: "enemy_cave_bat", percent: 50 }],
    commands: [],
    refusal: /전투 조건/u,
  },
  {
    conditions: [],
    commands: [{
      kind: "m2Command", commandId: "m2-098-change-enemy-hp",
      fields: { target: "enemy_cave_bat", operation: "set", value: 1 },
    }],
    refusal: /전투 명령/u,
  },
] satisfies (Pick<TroopRecord["battleEventPages"][number], "conditions" | "commands"> & { refusal: RegExp })[])(
  "같은 적을 앞에 추가해도 레코드 ID가 가리키는 첫 개체를 바꾸지 않는다 ($refusal)",
  ({ conditions, commands, refusal }) => {
    const seed = fixtureProject("built");
    const id = "troop_bat_swarm";
    const enemyId = "enemy_cave_bat";
    const battleEventPages: TroopRecord["battleEventPages"] = [{
      id: "page_first_match", name: "박쥐 개체 확인", span: "battle", conditions, commands,
    }];
    const project = { ...seed, database: {
      ...seed.database, troops: editRow(seed.database.troops, id, troop => ({
        ...troop, battleEventPages, members: undefined, enemyIds: ["enemy_slime", enemyId],
      })),
    } };
    const target = select(project, "troops", id);
    expectRefused(project, target, "db.troops.update", { members: [{ enemyId }, { enemyId }] }, refusal);
    const { after } = runPrimitive(project, target, "db.troops.update", {
      members: [{ enemyId: "enemy_slime" }, { enemyId }, { enemyId }],
    });
    expect(after.database.troops.find(troop => troop.id === id)?.enemyIds).toEqual(["enemy_slime", enemyId, enemyId]);
  },
);

it("부위의 본체가 다른 적이 될 수 있는 명단 교체를 거절한다", () => {
  const seed = fixtureProject("built");
  const id = "troop_bat_swarm";
  const project = { ...seed, database: {
    ...seed.database, troops: editRow(seed.database.troops, id, troop => ({
      ...troop, members: troop.members!.map((member, index) => index === 1 ? { ...member, partOf: 0 } : member),
    })),
  } };
  const target = select(project, "troops", id);
  expectRefused(project, target, "db.troops.update", {
    members: [{ enemyId: "enemy_slime" }, { enemyId: "enemy_cave_bat" }],
  }, /본체와 부위/u);
  const { after } = runPrimitive(project, target, "db.troops.update", { memberNumber: 2, hidden: true });
  expect(after.database.troops.find(troop => troop.id === id)?.members?.[1]).toMatchObject({ partOf: 0, hidden: true });
});

it("전투가 중첩 호출한 공통 이벤트의 적 대상까지 보호한다", () => {
  const seed = fixtureProject("built");
  const id = "troop_bat_swarm";
  const battleEventPages: TroopRecord["battleEventPages"] = [{
    id: "page_reveal", name: "숨은 적 부르기", span: "battle", conditions: [],
    commands: [{ kind: "m2Command", commandId: "m2-106-call-common-event", fields: { value: "common_reveal_wrapper" } }],
  }];
  const commonEvents: CommonEvent[] = [
    { id: "common_reveal_wrapper", name: "증원 호출", trigger: "none", commands: [{ kind: "callCommonEvent", commonEventId: "common_reveal" }] },
    { id: "common_reveal", name: "증원", trigger: "none", commands: [{
      kind: "fork", condition: { kind: "switch", switchId: seed.switches[0]!.id, value: true },
      then: [{ kind: "m2Command", commandId: "m2-101-enemy-encounter", fields: { target: "enemy-2" } }],
    }] },
  ];
  const project = { ...seed, commonEvents: [...seed.commonEvents, ...commonEvents], database: {
    ...seed.database, troops: editRow(seed.database.troops, id, troop => ({ ...troop, battleEventPages })),
  } };
  const target = select(project, "troops", id);
  expectRefused(project, target, "db.troops.update", { members: [{ enemyId: "enemy_cave_bat" }] }, /공통 이벤트/u);
  const { after } = runPrimitive(project, target, "db.troops.update", { memberNumber: 2, hidden: false });
  expect(after.commonEvents).toBe(project.commonEvents);
  expect(after.database.troops.find(troop => troop.id === id)?.battleEventPages).toBe(battleEventPages);
});

function openBattle(project: Project, troopId: string) {
  const command: Command = { kind: "battleProcessing", troopId, canEscape: false, canLose: true };
  const step = createInterpreter([command], startSession(project, 1), project).start();
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
  const session = startSession(after, 1);
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

it.each(["legacy", "metadata"] as const)("새 지형에 배치된 타일의 기존 태그가 연결되면 추가를 거절한다 (%s)", source => {
  const seed = fixtureProject("built");
  const map = seed.maps[seed.startMapId]!;
  const tileset = seed.tilesets[map.tilesetId]!;
  const tag = seed.database.terrains!.length + 1;
  const meta = { label: "", description: "", tags: [] };
  const tags = {
    terrain: [source === "legacy" ? tag : 0],
    tileMeta: source === "metadata" ? [{ ...meta, terrainTag: tag }] : undefined,
  };
  const project = {
    ...seed,
    maps: { ...seed.maps, [map.id]: { ...map, lowerTiles: [0, ...map.lowerTiles.slice(1)] } },
    tilesets: { ...seed.tilesets, [tileset.id]: { ...tileset, ...tags } },
  };
  const location = { mapId: map.id, x: 0, y: 0 };
  expect(terrainRecordAt(project, location)).toBeUndefined();
  const target = select(project, "terrains", "terrain_water");
  const args = { name: "용암", damage: 9 };
  expectRefused(project, target, "db.terrains.create", args, /배치된 타일/u);

  // A metadata override disconnects the tile even when a legacy tag remains underneath.
  const overridden = { ...project, tilesets: {
    ...project.tilesets, [tileset.id]: { ...tileset, terrain: [tag], tileMeta: [{ ...meta, terrainTag: 0 }] },
  } };
  const { after } = runPrimitive(overridden, target, "db.terrains.create", args);
  expect(after.database.terrains?.at(-1)?.damage).toBe(9);
  expect(terrainRecordAt(after, location)).toBeUndefined();
});

it("조건별 전리품을 쓰는 적의 구형 드롭률을 수정하지 않는다", () => {
  const seed = fixtureProject("built");
  const project = { ...seed, database: {
    ...seed.database, enemies: editRow(seed.database.enemies, "enemy_slime", enemy => ({
      ...enemy, rewards: { ...enemy.rewards, drops: [] },
    })),
  } };
  const target = select(project, "enemies", "enemy_slime");
  expectRefused(project, target, "db.enemies.update", { dropRatePercent: 50 }, /조건별 전리품/u);
  const { after } = runPrimitive(project, target, "db.enemies.update", { exp: 50 });
  expect(after.database.enemies.find(enemy => enemy.id === target.id)?.rewards).toMatchObject({ exp: 50, drops: [] });
});

it.each(["terrains", "battleCommands"] as const)("정규화가 기본값을 다시 만드는 %s의 마지막 행은 지우지 않는다", collection => {
  const seed = fixtureProject("blank");
  const row = { ...seed.database[collection]![0]!, id: "last_unreferenced" };
  const project = { ...seed, database: { ...seed.database, [collection]: [row] } };
  expectRefused(project, select(project, collection, row.id), `db.${collection}.delete`, {}, /마지막 항목/u);
});

it("긴 구형 무리의 숨김만 바꿔도 다른 적의 전투 위치를 보존한다", () => {
  const seed = fixtureProject("built");
  const id = "troop_bat_swarm";
  const troops = editRow(seed.database.troops, id, troop => ({
    ...troop, members: [], enemyIds: Array<string>(7).fill("enemy_cave_bat"),
  }));
  const before = { ...seed, database: { ...seed.database, troops } };
  const { after } = runPrimitive(before, select(before, "troops", id), "db.troops.update", {
    memberNumber: 1, hidden: true,
  });
  const battlers = (project: Project) => enemyBattlers(project, project.database.troops.find(troop => troop.id === id)!);
  expect(battlers(after)[0]?.hidden).toBe(true);
  expect(battlers(after).slice(1).map(({ battleX, battleY }) => [battleX, battleY]))
    .toEqual(battlers(before).slice(1).map(({ battleX, battleY }) => [battleX, battleY]));
  expect(battlers(after)[6]?.battleY).toBe(268);
});

it.each<["troops" | "battleCommands", string, Command, RegExp]>([
  ["troops", "troop_bat_swarm", {
    kind: "battleProcessing", troopId: "troop_bat_swarm", canEscape: false, canLose: true,
  }, /이벤트.*자료집 항목은 삭제할 수 없습니다/u],
  ["battleCommands", "cmd_defend", {
    kind: "m2Command", commandId: "m2-092-change-battle-commands",
    fields: { target: "party", operation: "set", slots: "cmd_attack, cmd_defend" },
  }, /사용 중/u],
])("삭제 실행과 게시에서 열린 이벤트 초안의 %s 참조를 보호한다", (collection, id, command, reason) => {
  const seed = fixtureProject("built");
  const map = seed.maps[seed.startMapId]!;
  const draft: GameEvent = {
    id: "event_draft_battle", name: "전투 초안", x: 0, y: 0, trigger: { kind: "action" },
    commands: [command],
    draft: { kind: "new" },
  };
  const live = store.replaceProject({ ...seed, maps: { ...seed.maps, [map.id]: { ...map, events: [...map.events, draft] } } });
  const target = select(live, collection, id);
  const primitive = `db.${collection}.delete`;
  expectRefused(live, target, primitive, {}, /사용 중/u);
  const before = smallTaskBase(live, target);
  expect(before.maps[map.id]?.events.some(event => event.id === draft.id)).toBe(false);
  expect(() => runPrimitive(before, target, primitive, {}, undefined, live)).toThrow(reason);
  const { after } = runPrimitive(before, target, primitive, {});
  expect(() => commitSmallTask(live, before, after, target)).toThrow(/열린 이벤트/u);
  expect(store.getCurrent()).toBe(live);
});

it.each([
  ["en", "Troop", "Battle command"],
  ["ja", "敵グループ", "戦闘コマンド"],
  ["zh", "敌群", "战斗指令"],
] as const)("작업 창의 무리와 전투 명령 라벨을 번역한다 (%s)", async (locale, troop, command) => {
  const seed = fixtureProject("built");
  const row = { id: "cmd_locale_test", name: "cmd_locale_test", kind: "defend" as const };
  const project = { ...seed, database: { ...seed.database, battleCommands: [...seed.database.battleCommands!, row] } };
  await setLocale(locale);
  try {
    const troopTarget = select(project, "troops", "troop_bat_swarm");
    expect(t(troopTarget.label)).toBe(`${troop} · 동굴 박쥐 떼`);
    const target = select(project, "battleCommands", row.id);
    expect(t(target.label)).toBe(command);
    const { after } = runPrimitive(project, target, "db.battleCommands.delete", {});
    expect(plainSummary(project, after).headline).toContain(command);
    expect(plainSummary(project, after).headline).not.toMatch(/[가-힣]/u);
  } finally {
    await setLocale("ko");
  }
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

it("열린 이벤트의 슬롯이 사용한 전투 명령 식별자를 다시 쓰지 않는다", () => {
  const seed = fixtureProject("built");
  const map = seed.maps[seed.startMapId]!;
  const draft: GameEvent = {
    id: "event_draft_slots", name: "전투 슬롯 초안", x: 0, y: 0, trigger: { kind: "action" }, draft: { kind: "new" },
    commands: [{ kind: "m2Command", commandId: "m2-092-change-battle-commands",
      fields: { target: "party", operation: "set", slots: "cmd_attack, cmd_small_1" } }],
  };
  const live = store.replaceProject({ ...seed, maps: { ...seed.maps, [map.id]: { ...map, events: [...map.events, draft] } } });
  const target = select(live, "battleCommands", "cmd_attack");
  const before = smallTaskBase(live, target);
  const create = (draftSource?: Project) => runPrimitive(before, target, "db.battleCommands.create", { name: "새 명령" }, undefined, draftSource).after;
  expect(create(live).database.battleCommands?.at(-1)?.id).toBe("cmd_small_2");
  const after = create();
  expect(after.database.battleCommands?.at(-1)?.id).toBe("cmd_small_1");
  expect(() => commitSmallTask(live, before, after, target)).toThrow(/열린 이벤트/u);
  expect(store.getCurrent()).toBe(live);
});

it("저장된 전투 이벤트가 사용하는 한 마리 무리는 명단을 비울 수 없다", () => {
  const seed = fixtureProject("built");
  const map = seed.maps[seed.startMapId]!;
  const id = "troop_bat_swarm";
  const event: GameEvent = {
    id: "event_roster_battle", name: "전투", x: 0, y: 0, trigger: { kind: "action" },
    commands: [{ kind: "battleProcessing", troopId: id, canEscape: false, canLose: true }],
  };
  const troops = editRow(seed.database.troops, id, troop => ({
    ...troop, members: troop.members!.slice(0, 1), enemyIds: troop.enemyIds.slice(0, 1), battleEventPages: [],
  }));
  const unused = { ...seed, database: { ...seed.database, troops } };
  const project = { ...unused, maps: { ...seed.maps, [map.id]: { ...map, events: [...map.events, event] } } };
  const target = select(project, "troops", id);
  expectRefused(project, target, "db.troops.update", { members: [] }, /한 마리 이상/u);
  const replacement = runPrimitive(project, target, "db.troops.update", { members: [{ enemyId: "enemy_slime" }] }).after;
  expect(replacement.database.troops.find(troop => troop.id === id)?.enemyIds).toEqual(["enemy_slime"]);
  const { after } = runPrimitive(unused, select(unused, "troops", id), "db.troops.update", { members: [] });
  expect(after.database.troops.find(troop => troop.id === id)).toMatchObject({ members: [], enemyIds: [] });
});

it("레코드 ID로 나오는 숨은 증원 개체를 보호한다", () => {
  const seed = fixtureProject("built");
  const id = "troop_bat_swarm";
  const bat = { enemyId: "enemy_cave_bat", x: 84, y: 52, hidden: false };
  const troops = editRow(seed.database.troops, id, troop => ({
    ...troop, enemyIds: [bat.enemyId, bat.enemyId], members: [bat, { ...bat, y: 88, hidden: true }],
    battleEventPages: [{ id: "reveal", name: "증원", span: "battle", conditions: [], commands: [{
      kind: "m2Command", commandId: "m2-101-enemy-encounter", fields: { target: bat.enemyId },
    }] }],
  }));
  const project = { ...seed, database: { ...seed.database, troops } };
  const target = select(project, "troops", id);
  const slime = { enemyId: "enemy_slime" };
  expectRefused(project, target, "db.troops.update", { members: [{ enemyId: bat.enemyId }, slime] }, /전투 명령/u);
  const { after } = runPrimitive(project, target, "db.troops.update", { members: [{ enemyId: bat.enemyId }, { enemyId: bat.enemyId }, slime] });
  expect(after.database.troops.find(troop => troop.id === id)?.members?.[1]).toMatchObject({ enemyId: bat.enemyId, hidden: true });
});

it("직업 명령이 카탈로그에서 상속하는 공통 이벤트의 적 대상을 보호한다", () => {
  const seed = fixtureProject("built");
  const id = "troop_bat_swarm";
  const commonEvent: CommonEvent = {
    id: "common_inherited_order", name: "두 번째 적 변경", trigger: "none",
    commands: [{ kind: "m2Command", commandId: "m2-098-change-enemy-hp",
      fields: { target: "enemy-2", operation: "set", value: 1 } }],
  };
  const inherited = { id: "cmd_inherited", name: "상속 명령", kind: "commonEvent" as const };
  const classes = seed.database.classes.map((row, index) => index === 0 ? { ...row, battleCommands: [...row.battleCommands, inherited] } : row);
  const battleCommands = [...seed.database.battleCommands!, { ...inherited, kind: "attack" as const, commonEventId: commonEvent.id }];
  const project = { ...seed, commonEvents: [...seed.commonEvents, commonEvent], database: { ...seed.database, classes, battleCommands } };
  expectRefused(project, select(project, "troops", id), "db.troops.update", {
    members: [{ enemyId: "enemy_cave_bat" }, { enemyId: "enemy_slime" }],
  }, /공통 이벤트/u);
});
