import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCARLOXY_ALL_MONSTER_KEYS,
  SCARLOXY_BACKDROP_ASSETS,
  SCARLOXY_CRY_ASSETS,
  SCARLOXY_MONSTER_ASSETS,
  SCARLOXY_MONSTER_ICON_ASSETS,
  SCARLOXY_RESOURCE_IDS,
  resolveScarloxyAssetUrl,
} from "@/assets/scarloxyPack";
import {
  SCARLOXY_ALL_SPECIES_KEYS,
  SCARLOXY_DEMO_SKILL_IDS,
  SCARLOXY_EXTRA_SPECIES_SEEDS,
  applyScarloxyBackSprites,
  createScarloxyExtraSkills,
  createScarloxyExtraSpeciesRecords,
  scarloxySpeciesCryResourceId,
  scarloxySpeciesResourceIds,
} from "@/project/defaults/scarloxyExtraSpecies";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { MonsterSpeciesRecord } from "@/project/types";

const PUBLIC = resolve(__dirname, "../public");

/** PNG IHDR 의 너비·높이. 디코더 없이 규격만 본다. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("Scarloxy 몬스터 도감 확장 (30종)", () => {
  it("30종 모두 정면·뒷모습 96x96, 아이콘, 울음소리 파일이 있다", () => {
    expect(SCARLOXY_ALL_MONSTER_KEYS).toHaveLength(30);
    expect(new Set(SCARLOXY_ALL_MONSTER_KEYS).size).toBe(30);
    expect([...SCARLOXY_ALL_SPECIES_KEYS].sort()).toEqual([...SCARLOXY_ALL_MONSTER_KEYS].sort());
    for (const asset of SCARLOXY_MONSTER_ASSETS) {
      const file = resolve(PUBLIC, asset.path);
      expect(existsSync(file), asset.path).toBe(true);
      expect(pngSize(file), asset.path).toEqual({ width: 96, height: 96 });
    }
    expect(SCARLOXY_MONSTER_ASSETS.filter((asset) => asset.id.endsWith("-back"))).toHaveLength(30);
    for (const asset of [...SCARLOXY_MONSTER_ICON_ASSETS, ...SCARLOXY_CRY_ASSETS]) {
      expect(existsSync(resolve(PUBLIC, asset.path)), asset.path).toBe(true);
    }
    for (const asset of SCARLOXY_MONSTER_ICON_ASSETS) {
      const size = pngSize(resolve(PUBLIC, asset.path));
      expect(Math.max(size.width, size.height), asset.path).toBeLessThanOrEqual(64);
    }
  });

  it("울음소리는 짧은 16bit 모노 WAV 다", () => {
    for (const asset of SCARLOXY_CRY_ASSETS) {
      const bytes = readFileSync(resolve(PUBLIC, asset.path));
      expect(bytes.toString("ascii", 0, 4), asset.id).toBe("RIFF");
      expect(bytes.readUInt16LE(22), asset.id).toBe(1);
      const seconds = (bytes.length - 44) / (bytes.readUInt32LE(24) * 2);
      expect(seconds, asset.id).toBeGreaterThan(0.2);
      expect(seconds, asset.id).toBeLessThan(1.5);
    }
  });

  it("새 전투 배경 4장이 640x360 으로 등록된다", () => {
    for (const key of ["cave", "gym", "beach", "route"]) {
      const asset = SCARLOXY_BACKDROP_ASSETS.find((entry) => entry.id === `scarloxy-backdrop-${key}`);
      expect(asset, key).toBeDefined();
      expect(pngSize(resolve(PUBLIC, asset!.path))).toEqual({ width: 640, height: 360 });
    }
  });

  it("모든 종 리소스 id 가 해석되고 참조 검증 목록에 있다", () => {
    const known = new Set(SCARLOXY_RESOURCE_IDS);
    for (const key of SCARLOXY_ALL_MONSTER_KEYS) {
      for (const id of Object.values(scarloxySpeciesResourceIds(key))) {
        expect(known.has(id), id).toBe(true);
        expect(resolveScarloxyAssetUrl(id), id).toMatch(/^\/assets\/scarloxy\//);
      }
    }
  });

  it("새 11종은 데모 기술이나 새 기술만 배우고, 진화 대상은 새 종 안에 있다", () => {
    const skills = new Set([...SCARLOXY_DEMO_SKILL_IDS, ...createScarloxyExtraSkills().map((skill) => skill.id)]);
    const records = createScarloxyExtraSpeciesRecords();
    const ids = new Set(records.map((record) => record.id));
    expect(records).toHaveLength(11);
    for (const record of records) {
      expect(record.graphic.backResourceId).toBe(`${record.graphic.monsterResourceId}-back`);
      for (const move of record.skillsByLevel ?? []) expect(skills.has(move.skillId), `${record.id} ${move.skillId}`).toBe(true);
      for (const evolution of record.evolutions ?? []) expect(ids.has(evolution.toSpeciesId), evolution.toSpeciesId).toBe(true);
    }
    expect(SCARLOXY_EXTRA_SPECIES_SEEDS.filter((seed) => seed.evolvesTo)).toHaveLength(3);
    const types = new Set<string>(SCARLOXY_EXTRA_SPECIES_SEEDS.flatMap((seed) => seed.types));
    for (const type of ["rock", "ground", "bug", "electric", "poison", "fighting", "ice", "ghost"]) expect(types.has(type), type).toBe(true);
  });

  it("뒷모습을 단 새 종이 저장·불러오기를 통과한다", () => {
    const project = createBlankProject();
    project.database.skills.push(...createScarloxyExtraSkills());
    const skillIds = new Set(project.database.skills.map((skill) => skill.id));
    // 빈 프로젝트에는 데모 기술이 없으므로 있는 기술만 남긴 사본으로 참조 검증을 통과시킨다.
    const species = createScarloxyExtraSpeciesRecords().map((record) => ({ ...record, skillsByLevel: record.skillsByLevel?.filter((move) => skillIds.has(move.skillId)) }));
    project.database.monsterSpecies = [...(project.database.monsterSpecies ?? []), ...species];
    const loaded = deserialize(serialize(project));
    const pebblit = loaded.database.monsterSpecies?.find((record) => record.id === "species_scarloxy_pebblit");
    expect(pebblit?.name).toBe("자갈콩");
    expect(pebblit?.graphic.backResourceId).toBe("scarloxy-monster-pebblit-back");
  });

  it("applyScarloxyBackSprites 는 비어 있는 뒷모습만 채운다", () => {
    const stats = { maxHp: 1, maxMp: 1, attack: 1, defense: 1, mind: 1, agility: 1 };
    const species: MonsterSpeciesRecord[] = [
      { id: "species_scarloxy_mossling", name: "모슬링", graphic: { monsterResourceId: "scarloxy-monster-mossling", graphicHue: 0, transparent: false, flying: false }, baseStats: stats, captureRate: 0.5 },
      { id: "species_scarloxy_emberkit", name: "엠버킷", graphic: { monsterResourceId: "scarloxy-monster-emberkit", backResourceId: "custom-back", graphicHue: 0, transparent: false, flying: false }, baseStats: stats, captureRate: 0.5 },
      { id: "species_other", name: "기타", graphic: { graphicHue: 0, transparent: false, flying: false }, baseStats: stats, captureRate: 0.5 },
    ];
    expect(applyScarloxyBackSprites(species)).toBe(1);
    expect(species[0]!.graphic.backResourceId).toBe("scarloxy-monster-mossling-back");
    expect(species[1]!.graphic.backResourceId).toBe("custom-back");
    expect(species[2]!.graphic.backResourceId).toBeUndefined();
    expect(scarloxySpeciesCryResourceId("species_scarloxy_atrox")).toBe("scarloxy-cry-atrox");
    expect(scarloxySpeciesCryResourceId("species_other")).toBeUndefined();
  });
});
