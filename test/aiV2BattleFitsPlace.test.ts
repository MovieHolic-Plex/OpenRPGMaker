import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { applyThemeBackdrop } from "@/ai/v2/place/placeTheme";
import { fillBattleBackgrounds, fillEnemyHpLook } from "@/ai/v2/story/shipLookDefaults";
import { growStartPartyCurves } from "@/ai/v2/story/pathBattleTension";
import { isFieldBattleBackdrop, resolveBattleBackdrop } from "@/battle/battleBackdrop";
import { actorBattlers } from "@/battle/battleBattlers";
import { BATTLE_SCENERY_STILLS, unknownSceneryIdMessage } from "@/assets/battleSceneryCatalog";
import { chaserEvents, chaserMapsWithoutHiding } from "@/project/chaserHiding";
import { FIELD_BATTLE_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { addFitSkills, fitEnemyToStartParty, fitTroopCopy } from "@/editor/tools/bossThreatScaling";
import { parseArtGap } from "@/project/artGap";
import { fitPathBattlesIn, PATH_TROOP_PREFIX } from "@/ai/v2/story/pathBattleBudget";
import { fitUnwinnableStepBattlesIn } from "@/ai/v2/story/blueprintPathBattles";
import { simulateBattle } from "@/battle/simulate";
import type { EnemyRecord, GameEvent, Project, SkillRecord } from "@/project/types";

// 2026-11-12 오너가 해 본 판(r1s-fun «증기의 심장»): 공장 거리 전투가 햇살 풀밭에서, 보일러실·기관실 전투가 동굴에서 벌어졌다.
// 길 적은 두 대에 쓰러지며 한 번도 못 쳤고, 레벨이 올라도 최대 HP 가 514 그대로였고, 불의 정령이 «산성 침» 을 썼고, 적 체력이 안 보였고,
// 순찰 적은 주인공 바로 옆을 스쳐 지나갔다. 문서 openwiki/assistant-v2.md 「전투가 장소·파티에 맞는다」. 재는 법(모델 없음): scripts/qa/assistant-v2/battleFitProbe.mts.

function world(setting: string, tilesetId: string, places: { name: string; kind: string }[]): { project: Project; mapId: string } {
  const project = createBlankProject() as Project;
  const map = project.maps[project.startMapId]!;
  map.tilesetId = tilesetId;
  map.name = places[0]!.name;
  project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", setting, playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" }, places,
    steps: [{ id: "s1", place: map.name, event: "x", action: "a", gives: "가", feeling: "f" }, { id: "s2", place: map.name, event: "y", action: "b", needs: "가", gives: "엔딩", feeling: "f" }] });
  return { project, mapId: map.id };
}

const backdropAt = (project: Project, mapId: string, name: string): { id: string | undefined; gap: ReturnType<typeof parseArtGap> } => {
  const map = project.maps[mapId]!;
  map.name = name;
  delete (map as { battleBackground?: string }).battleBackground;
  const res = applyThemeBackdrop(project, mapId);
  return { id: map.battleBackground, gap: res.gap ? parseArtGap(res.gap) : undefined };
};

describe("전투 배경은 그 장소의 것이다", () => {
  it("증기 도시의 거리·보일러실·기관실은 그 장소 그림, 그림이 없는 여관은 그 맵 그대로(없는 그림 줄)", () => {
    const { project, mapId } = world("steampunk_city", "steampunk_city", [
      { name: "굴뚝 공업지구", kind: "industrial" }, { name: "보일러실", kind: "boiler-room" }, { name: "기관실", kind: "engine-room" }, { name: "여관", kind: "inn" }]);
    expect(backdropAt(project, mapId, "굴뚝 공업지구")).toEqual({ id: "battle-scenery-brick-street", gap: undefined });
    expect(backdropAt(project, mapId, "보일러실")).toEqual({ id: "battle-scenery-boiler-room", gap: undefined });
    expect(backdropAt(project, mapId, "기관실")).toEqual({ id: "battle-scenery-boiler-room", gap: undefined });
    const inn = backdropAt(project, mapId, "여관");
    expect(inn.id).toBe(FIELD_BATTLE_BACKGROUND_ID);
    expect(inn.gap).toMatchObject({ theme: "steampunk_city/inn", want: "backdrop", standIn: FIELD_BATTLE_BACKGROUND_ID });
  });

  it("세계 표가 가리키는 장소 그림은 모두 번들에 실려 있다(지어낸 id 가 아니다)", () => {
    const stills = new Set(BATTLE_SCENERY_STILLS.map((still) => still.resourceId));
    for (const key of ["tomb", "boiler-room", "brick-street", "ice-cave", "beach", "cloud-sea", "swamp", "volcano", "edo-town", "station", "sky-shrine", "shipwreck"]) {
      expect(stills.has(`battle-scenery-${key}`)).toBe(true);
    }
    expect(unknownSceneryIdMessage(FIELD_BATTLE_BACKGROUND_ID)).toBeUndefined();
  });

  it("세계 표 밖의 맵은 같은 종류라고 말할 수 있을 때만 겹 배경, 아니면 그 맵 그대로 — 실내가 동굴이, 도시가 풀밭이 되지 않는다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const fill = (name: string, tilesetId: string): string | undefined => {
      map.name = name;
      map.tilesetId = tilesetId;
      delete (map as { battleBackground?: string }).battleBackground;
      fillBattleBackgrounds(project, map.id);
      return map.battleBackground;
    };
    expect(fill("이름 없는 방", "atlas_biome_interior")).toBe(FIELD_BATTLE_BACKGROUND_ID);
    expect(fill("중앙 광장 거리", "modern3")).toBe(FIELD_BATTLE_BACKGROUND_ID);
    expect(fill("어두운 숲길", "beodeul_city")).toBe("battle-scenery-forest");
    expect(fill("들판", "beodeul_city")).toBe("battle-scenery-plains");
  });

  it("«그 맵 그대로» 표시는 런타임이 그대로 고른다 — 겹 배경으로 바꾸지 않는다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.battleBackground = FIELD_BATTLE_BACKGROUND_ID;
    const troopId = project.database.troops[0]!.id;
    const id = resolveBattleBackdrop({ project, troopId, location: { mapId: map.id, x: 1, y: 1 } });
    expect(id).toBe(FIELD_BATTLE_BACKGROUND_ID);
    expect(isFieldBattleBackdrop(id)).toBe(true);
    expect(isFieldBattleBackdrop("battle-scenery-cave")).toBe(false);
  });
});

describe("전투가 파티에 맞는다", () => {
  it("레벨이 오르면 능력치가 오른다 — 시작 파티 곡선의 바닥(되풀이 안전)", () => {
    const project = createBlankProject() as Project;
    const ids = project.system.startActorIds!;
    const hpAt = (level: number) => actorBattlers(project, { levels: { [ids[0]!]: level }, partyActorIds: [ids[0]!] })[0]!.maxHp;
    const flat = [hpAt(1), hpAt(2)];
    expect(growStartPartyCurves(project, ids).length).toBeGreaterThan(0);
    expect(hpAt(2)).toBeGreaterThan(flat[0]!);
    expect(hpAt(2)).toBeGreaterThanOrEqual(Math.round(flat[0]! * 1.06));
    expect(hpAt(5)).toBeGreaterThan(hpAt(4));
    expect(hpAt(1)).toBe(flat[0]);
    expect(growStartPartyCurves(project, ids)).toEqual([]);
  });

  it("너무 센 기술은 다른 생물의 기술로 바꾸지 않고 그 적 자신의 기술을 약하게 한 사본으로 쓴다", () => {
    const project = createBlankProject() as Project;
    const source = project.database.skills.find((skill) => skill.effect?.kind === "damage" && skill.effect.affects === "hp" && !skill.damageFormula && skill.scope === "enemy")!;
    const own: SkillRecord = { ...structuredClone(source), id: "skill_ember_burst", name: "불꽃 터뜨리기", power: 400 };
    project.database.skills.push(own);
    const base = project.database.enemies[0]!;
    const enemy: EnemyRecord = { ...structuredClone(base), id: "enemy_spirit_test", name: "불의 정령", actions: [{ ...(base.actions?.[0] ?? { rating: 5 }), skillId: own.id }] } as EnemyRecord;
    project.database.enemies.push(enemy);
    const fit = fitEnemyToStartParty(project, enemy, "field")!;
    expect(fit).toBeDefined();
    addFitSkills(project, fit);
    const used = (fit.actions ?? []).map((action) => project.database.skills.find((skill) => skill.id === action.skillId)!);
    expect(used.length).toBeGreaterThan(0);
    for (const skill of used) {
      expect(skill.name).toBe("불꽃 터뜨리기");
      expect(skill.id.startsWith("skill_fit_field_")).toBe(true);
      expect(skill.power).toBeLessThan(400);
    }
    // 원래 기술은 그대로다(다른 적·영웅에 번지지 않는다).
    expect(project.database.skills.find((skill) => skill.id === own.id)!.power).toBe(400);
  });

  it("도트 측면 전투가 있으면 적 이름표·체력 막대를 켠다 — 저작자가 고른 칸은 그대로", () => {
    const project = createBlankProject() as Project;
    expect(fillEnemyHpLook(project)).toEqual([]);
    const map = project.maps[project.startMapId]!;
    map.events.push({ id: "ev_foe", name: "", x: 3, y: 3, pages: [{ conditions: [], trigger: { kind: "eventTouch" }, commands: [{ kind: "battleProcessing", troopId: project.database.troops[0]!.id }] }] } as never);
    expect(fillEnemyHpLook(project)).toHaveLength(1);
    expect(project.system.battleLook).toMatchObject({ enemyHp: true, enemyNames: true });
    expect(fillEnemyHpLook(project)).toEqual([]);
    const chosen = createBlankProject() as Project;
    chosen.maps[chosen.startMapId]!.events.push(structuredClone(map.events.at(-1)!));
    chosen.system.battleLook = { enemyHp: false, enemyNames: false };
    expect(fillEnemyHpLook(chosen)).toEqual([]);
    expect(chosen.system.battleLook).toEqual({ enemyHp: false, enemyNames: false });
  });

  it("주인공을 알아채고 다가와 싸움을 거는 보이는 적은 «숨어서 피할 추격자» 가 아니다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const chasePage = (commands: unknown[]) => ({ id: "p", name: "p", conditions: [], trigger: { kind: "eventTouch" }, movement: { type: "chase", speed: 3, frequency: 3, sightRange: 3 }, commands });
    const foe = { id: "ev_foe", name: "", x: 3, y: 3, pages: [chasePage([{ kind: "battleProcessing", troopId: project.database.troops[0]!.id, canEscape: true, canLose: false }])] } as unknown as GameEvent;
    const stalker = { id: "ev_stalker", name: "", x: 5, y: 5, pages: [chasePage([{ kind: "gameOver" }])] } as unknown as GameEvent;
    const punisher = { id: "ev_punisher", name: "", x: 7, y: 7, pages: [chasePage([{ kind: "battleProcessing", troopId: project.database.troops[0]!.id, canEscape: false, canLose: true }])] } as unknown as GameEvent;
    map.events = [foe];
    expect(chaserEvents(map)).toEqual([]);
    expect(chaserMapsWithoutHiding(project)).toEqual([]);
    map.events = [foe, stalker, punisher];
    expect(chaserEvents(map).map((ev) => ev.id)).toEqual(["ev_stalker", "ev_punisher"]);
  });
});

describe("보스는 «공격» 만으로는 못 이긴다", () => {
  it("길 위 전투 수 + 보스전 몫의 회복약을 들고 시작하고, 보스 사본은 약·기술로는 이기고 공격만으로는 진다 — 다시 돌려도 그대로", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const boss = fitTroopCopy(project, "troop_slime", "boss")!;
    const page = (troopId: string, canEscape: boolean, kind: string) => ({ id: "p0", name: "p0", conditions: [], trigger: { kind }, commands: [{ kind: "battleProcessing", troopId, canEscape, canLose: false }] });
    map.events = [...(map.events ?? []),
      { id: "ev_foe", name: "", x: 3, y: 3, trigger: { kind: "eventTouch" }, pages: [page("troop_slime", true, "eventTouch")] },
      { id: "ev_boss", name: "문지기", x: 6, y: 3, trigger: { kind: "action" }, pages: [page(boss, false, "action")] }] as never;
    project.gameBlueprint = { request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", ending: { name: "끝", how: "z", feeling: "w" },
      steps: [{ id: "s1", place: map.name ?? map.id, event: "ev_foe", label: "l" }, { id: "s2", place: map.name ?? map.id, event: "문지기", label: "l" }] } as never;
    const ids = project.system.startActorIds!;
    const notes = fitPathBattlesIn(project);
    expect(notes.some((line) => line.includes("보스전 2"))).toBe(true);
    const bossTroop = () => ((map.events.find((e) => e.id === "ev_boss")!.pages![0]!.commands![0]) as unknown as { troopId: string }).troopId;
    const troopId = bossTroop();
    expect(troopId.startsWith(PATH_TROOP_PREFIX)).toBe(true);
    const potion = Object.keys(project.session.inventory ?? {}).find((id) => (project.session.inventory?.[id] ?? 0) >= 3)!;
    expect(potion).toBeDefined();
    const attackOnly = simulateBattle({ project, troopId, heroLevel: 1, partyActorIds: ids, n: 24, seed: 11 });
    // 길 위 전투를 피해 Lv1 로 온 판은 시작 회복약을 다 들고 있다.
    const sensible = simulateBattle({ project, troopId, heroLevel: 1, partyActorIds: ids, n: 24, seed: 11, useSkills: true, inventory: { [potion]: project.session.inventory![potion]! }, potionItemId: potion });
    expect(attackOnly.winRate).toBeLessThanOrEqual(0.15);
    expect(sensible.winRate).toBeGreaterThanOrEqual(0.95);
    expect(sensible.avgPotionsUsed).toBeGreaterThan(1);
    // 다시 돌려도 보스는 더 오르지 않고, «못 이기는 전투 맞추기» 가 맨몸으로 다시 재 사본을 또 만들지 않는다.
    const stats = JSON.stringify(project.database.enemies.map((e) => [e.id, e.stats]));
    expect(fitPathBattlesIn(project).filter((line) => line.includes("(보스)"))).toEqual([]);
    expect(fitUnwinnableStepBattlesIn(project)).toEqual([]);
    expect(bossTroop()).toBe(troopId);
    expect(JSON.stringify(project.database.enemies.map((e) => [e.id, e.stats]))).toBe(stats);
  }, 180_000);
});

