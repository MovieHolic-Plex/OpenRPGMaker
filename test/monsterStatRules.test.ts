// 몬스터 성격·노력치(옵트인) — 공식, 저장 바이트, 노력치 상한·합산, evYield 정규화, giveMonster 의 성격 부여.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { giveMonster, monsterBattleStats, monsterBattleStatsForSpecies, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { MONSTER_NATURES, addMonsterEvs, clampMonsterEvs, monsterEvYieldOf, monsterNatureEffectText, natureIdFromSeed } from "@/project/monsterStatRules";
import { startSession } from "@/project/session";
import type { MonsterSpeciesRecord, Project } from "@/project/types";

function speciesRecord(extra: Partial<MonsterSpeciesRecord> = {}): MonsterSpeciesRecord {
  return normalizeMonsterSpeciesRecord({
    id: "sp", name: "Sp", graphic: { graphicHue: 0, transparent: false, flying: false },
    baseStats: { maxHp: 40, maxMp: 0, attack: 50, defense: 50, mind: 50, agility: 50 },
    captureRate: 0.5, ...extra,
  });
}

function fixture(rules?: { natures?: boolean; evs?: boolean }): Project {
  const project = createBlankProject();
  project.database.monsterSpecies = [speciesRecord()];
  project.system.monsterCollection = true;
  if (rules) project.system.monsterStatRules = rules;
  return project;
}

const IVS = { hp: 10, atk: 10, def: 10, spd: 10 };

describe("monsterBattleStatsForSpecies extras", () => {
  const species = speciesRecord();

  it("is byte-identical to the old formula without extras", () => {
    // 50 level: floor((100+10)*50/100)+5 = 60, HP floor((80+10)*50/100)+60 = 105
    expect(monsterBattleStatsForSpecies(species, 50, IVS)).toMatchObject({ maxHp: 105, attack: 60, defense: 60, agility: 60 });
    expect(monsterBattleStatsForSpecies(species, 50, IVS, {})).toEqual(monsterBattleStatsForSpecies(species, 50, IVS));
  });

  it("applies +10% / -10% after the base formula and leaves HP and the other stats alone", () => {
    const stats = monsterBattleStatsForSpecies(species, 50, IVS, { nature: "brave" });
    expect(stats.attack).toBe(66);
    expect(stats.agility).toBe(54);
    expect(stats.defense).toBe(60);
    expect(stats.maxHp).toBe(105);
  });

  it("still moves a single-digit stat by at least 1 (small-stat games)", () => {
    const tiny = speciesRecord({ baseStats: { maxHp: 5, maxMp: 0, attack: 1, defense: 1, mind: 1, agility: 1 } });
    const plain = monsterBattleStatsForSpecies(tiny, 5, IVS);
    const brave = monsterBattleStatsForSpecies(tiny, 5, IVS, { nature: "brave" });
    expect(brave.attack).toBe(plain.attack + 1);
    expect(brave.agility).toBe(Math.max(1, plain.agility - 1));
  });

  it("a neutral nature changes nothing", () => {
    expect(monsterBattleStatsForSpecies(species, 50, IVS, { nature: "steady" })).toEqual(monsterBattleStatsForSpecies(species, 50, IVS));
  });

  it("adds floor(ev/4) to the stat before the level scale", () => {
    // Levels clamp to ACTOR_LEVEL_MAX (99), so the requested Lv100 is scaled by 99/100: the +63 lands before the scale.
    const base = monsterBattleStatsForSpecies(species, 100, IVS);
    const withEv = monsterBattleStatsForSpecies(species, 100, IVS, { evs: { atk: 252, hp: 252 } });
    const scaled = (raw: number): number => Math.floor(raw * 99 / 100);
    expect(withEv.attack - base.attack).toBe(scaled(2 * 50 + 10 + 63) - scaled(2 * 50 + 10));
    expect(withEv.maxHp - base.maxHp).toBe(scaled(2 * 40 + 10 + 63) - scaled(2 * 40 + 10));
    expect(withEv.maxHp - base.maxHp).toBe(62);
  });
});

describe("rules gate", () => {
  it("ignores nature and evs on the instance while the project rules are off", () => {
    const project = fixture();
    const session = startSession(project, 1);
    const given = giveMonster(project, session, { speciesId: "sp", level: 50, nature: "brave" });
    if (!given.ok) throw new Error("fixture");
    expect(given.instance.nature).toBeUndefined();
    expect(monsterBattleStats(project, { ...given.instance, nature: "brave", evs: { hp: 0, atk: 252, def: 0, spd: 0 } })).toEqual(monsterBattleStats(project, given.instance));
  });

  it("gives a deterministic nature when natures is on, and honours an authored one", () => {
    const project = fixture({ natures: true });
    const session = startSession(project, 1);
    const first = giveMonster(project, session, { speciesId: "sp", level: 5 });
    const authored = giveMonster(project, session, { speciesId: "sp", level: 5, nature: "timid" });
    if (!first.ok || !authored.ok) throw new Error("fixture");
    expect(MONSTER_NATURES.some((nature) => nature.id === first.instance.nature)).toBe(true);
    expect(authored.instance.nature).toBe("timid");
    expect(natureIdFromSeed("a")).toBe(natureIdFromSeed("a"));
  });
});

describe("evs helpers", () => {
  it("clamps per stat 255 and total 510", () => {
    // Over the 510 total, clampMonsterEvs trims from the last stat backwards (spd → def → atk → hp).
    expect(clampMonsterEvs({ hp: 300, atk: 300, def: 300, spd: 0 })).toEqual({ hp: 255, atk: 255, def: 0, spd: 0 });
    expect(clampMonsterEvs({ hp: 200, atk: 200, def: 200, spd: 200 })).toEqual({ hp: 200, atk: 200, def: 110, spd: 0 });
    expect(clampMonsterEvs(undefined)).toEqual({ hp: 0, atk: 0, def: 0, spd: 0 });
  });

  it("adds a gain without exceeding the caps and returns the base when nothing is gained", () => {
    expect(addMonsterEvs({ hp: 0, atk: 254, def: 0, spd: 0 }, { atk: 3 }).atk).toBe(255);
    expect(addMonsterEvs({ hp: 1, atk: 2, def: 3, spd: 4 }, undefined)).toEqual({ hp: 1, atk: 2, def: 3, spd: 4 });
  });

  it("sums evYield over defeated species and is undefined when there is none", () => {
    const a = speciesRecord({ evYield: { atk: 2 } });
    const b = speciesRecord({ evYield: { atk: 1, spd: 1 } });
    expect(monsterEvYieldOf([a, b, undefined])).toEqual({ atk: 3, spd: 1 });
    expect(monsterEvYieldOf([speciesRecord()])).toBeUndefined();
  });
});

describe("normalization", () => {
  it("cuts evYield to 0-3 per stat, total 3, and drops it when empty", () => {
    expect(speciesRecord({ evYield: { hp: 9, atk: 9 } }).evYield).toEqual({ hp: 3 });
    expect(speciesRecord({ evYield: { hp: 0 } }).evYield).toBeUndefined();
    expect(speciesRecord().evYield).toBeUndefined();
  });

  it("keeps monsterStatRules only for the axes that are on", () => {
    // Break: the system normalizer is a whitelist; a field it forgets vanishes on one save/load round trip.
    expect(normalizeSystemRecords({ startActorIds: [] }).monsterStatRules).toBeUndefined();
    expect(normalizeSystemRecords({ startActorIds: [], monsterStatRules: { natures: false, evs: false } }).monsterStatRules).toBeUndefined();
    expect(normalizeSystemRecords({ startActorIds: [], monsterStatRules: { natures: true, evs: false } }).monsterStatRules).toEqual({ natures: true });
  });

  it("describes a nature in a few characters", () => {
    expect(monsterNatureEffectText(MONSTER_NATURES.find((nature) => nature.id === "brave"))).toBe("공격↑ 속도↓");
    expect(monsterNatureEffectText(MONSTER_NATURES.find((nature) => nature.id === "steady"))).toBe("능력 보정 없음");
  });
});
