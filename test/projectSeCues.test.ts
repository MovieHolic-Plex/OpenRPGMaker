import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { validateSystem } from "@/project/io/shapeDatabaseFields";
import {
  SE_CUE_IDS, footstepCueForTerrain, isSeCueId, magicCueForElement, normalizeSeCues, projectSeCue, seCueFallbacks,
} from "@/project/seCues";
import { SYSTEM_SE_CUES } from "@/project/systemAudioOverrides";
import { authoredBattleCue, skillSeCue } from "@/player/battleJuice";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import { FOOTSTEP_MIN_INTERVAL_MS, footstepResourceAt, playFootstep, resetFootstepClock } from "@/player/footsteps";
import type { Project } from "@/project/types";

function withCues(cues: Record<string, string>): Project {
  const project = createBlankProject();
  project.system.seCues = cues;
  return project;
}

describe("project.system.seCues 자리 표", () => {
  it("시스템 효과음 13자리가 모두 알려진 자리다(스토어 제작자 목록과 같은 id)", () => {
    for (const cue of SYSTEM_SE_CUES) expect(SE_CUE_IDS).toContain(cue);
    for (const cue of ["equip", "save", "load", "bossCollapse", "actorDamage", "cast", "levelUp", "itemGet", "magic-fire", "footstep-grass"]) expect(SE_CUE_IDS).toContain(cue);
  });

  it("모르는 자리 id 도 꼴만 맞으면 저장한다 — 새 스토어 자리에 코드 수정이 필요 없다", () => {
    expect(normalizeSeCues({ "footstep-lava": "snd_a", confirm: " snd_b ", "bad id": "x", empty: "  ", num: 3 })).toEqual({ "footstep-lava": "snd_a", confirm: "snd_b" });
    expect(normalizeSeCues({})).toBeUndefined();
    expect(isSeCueId("magic-fire")).toBe(true);
    expect(isSeCueId("Magic")).toBe(false);
  });

  it("저장 왕복: 정규화가 표를 지키고, 빈 표는 저장하지 않는다(옛 JSON 바이트)", () => {
    const project = createBlankProject();
    project.system.seCues = { save: "snd_save" };
    expect(normalizeSystemRecords(project.system).seCues).toEqual({ save: "snd_save" });
    delete project.system.seCues;
    expect("seCues" in normalizeSystemRecords(project.system)).toBe(false);
    expect(() => validateSystem({ startActorIds: [], seCues: { save: "snd_save" } })).not.toThrow();
    expect(() => validateSystem({ startActorIds: [], seCues: { "not ok": "x" } })).toThrow();
  });

  it("가족 물러섬: magic-<속성> → cast, attack-<종류> → attack", () => {
    expect(seCueFallbacks("magic-fire")).toEqual(["magic-fire", "cast"]);
    expect(seCueFallbacks("attack-blunt")).toEqual(["attack-blunt", "attack"]);
    expect(seCueFallbacks("footstep-snow")).toEqual(["footstep-snow"]);
    expect(projectSeCue(withCues({ cast: "snd_cast" }), "magic-ice")).toBe("snd_cast");
    expect(projectSeCue(withCues({ "magic-ice": "snd_ice", cast: "snd_cast" }), "magic-ice")).toBe("snd_ice");
  });

  it("기술 속성 → 마법 자리, 마력 기술은 cast", () => {
    const project = createBlankProject();
    expect(magicCueForElement("fire")).toBe("magic-fire");
    expect(magicCueForElement("x", "번개")).toBe("magic-thunder");
    expect(skillSeCue(project, { elementId: "ice", effect: { kind: "damage", statistic: "attack", affects: "hp" } })).toBe("magic-ice");
    expect(skillSeCue(project, { effect: { kind: "healing", statistic: "mind", affects: "hp" } })).toBe("cast");
    expect(skillSeCue(project, { effect: { kind: "damage", statistic: "attack", affects: "hp" } })).toBeUndefined();
  });
});

describe("전투 사건 → 자리: 세션 덮어쓰기 → 프로젝트 표 → 기본", () => {
  it("프로젝트 표가 기본을 대신하고, 세션 덮어쓰기가 표보다 먼저다", () => {
    const project = withCues({ damage: "snd_hit", critical: "snd_crit" });
    expect(authoredBattleCue("hit-damage", project, undefined)).toEqual({ resourceId: "snd_hit" });
    const session = { systemAudioOverrides: { se: { damage: { resourceId: "snd_session", volume: 80 } } } };
    expect(authoredBattleCue("hit-damage", project, session)).toEqual({ resourceId: "snd_session", volume: 80 });
    expect(authoredBattleCue("hit-miss", project, undefined)).toBeUndefined();
  });

  it("세션 덮어쓰기의 빈 소리는 무음(null)이다", () => {
    const session = { systemAudioOverrides: { se: { damage: { resourceId: "", volume: 100 } } } };
    expect(authoredBattleCue("hit-damage", withCues({ damage: "snd_hit" }), session)).toBeNull();
  });

  it("아군 피해는 actorDamage → damage, 보스 쓰러짐은 bossCollapse → faint 로 물러선다", () => {
    expect(authoredBattleCue("hit-actor", withCues({ damage: "snd_hit" }), undefined)).toEqual({ resourceId: "snd_hit" });
    expect(authoredBattleCue("hit-actor", withCues({ damage: "snd_hit", actorDamage: "snd_ouch" }), undefined)).toEqual({ resourceId: "snd_ouch" });
    expect(authoredBattleCue("boss-collapse", withCues({ faint: "snd_faint" }), undefined)).toEqual({ resourceId: "snd_faint" });
    expect(authoredBattleCue("boss-collapse", withCues({ faint: "snd_faint", bossCollapse: "snd_boss" }), undefined)).toEqual({ resourceId: "snd_boss" });
  });
});

describe("메뉴 사건 → 자리", () => {
  it("부른 쪽의 자리(save)가 사건의 기본 자리(confirm)보다 먼저, 없으면 confirm, 그것도 없으면 기본 소리", () => {
    const project = withCues({ save: "snd_save", confirm: "snd_ok" });
    expect(emitRuntimeJuice({ event: "menu-confirm", cue: "save", project }).soundResourceId).toBe("snd_save");
    expect(emitRuntimeJuice({ event: "menu-confirm", cue: "equip", project }).soundResourceId).toBe("snd_ok");
    expect(emitRuntimeJuice({ event: "menu-confirm", cue: "equip", project: createBlankProject() }).soundResourceId).toBe("easyrpg-sound-decision1");
  });

  it("메뉴 열기는 menuOpen 자리를 먼저 본다", () => {
    expect(emitRuntimeJuice({ event: "menu-open", project: withCues({ menuOpen: "snd_open", confirm: "snd_ok" }) }).soundResourceId).toBe("snd_open");
  });
});

describe("지형 발소리", () => {
  function steppingProject(terrain: { name: string; footstepSoundResourceId?: string }, cues?: Record<string, string>): Project {
    const project = createBlankProject();
    const map = Object.values(project.maps)[0]!;
    const tileset = project.tilesets[map.tilesetId]!;
    const tile = map.lowerTiles[0]!;
    // 그 칸의 지형 태그 1 = terrains[0]. tileMeta 칸이 이기므로 terrain 배열만 바꾸면 된다(tileMeta 가 있으면 그쪽도).
    const meta = tileset.tileMeta?.[tile];
    if (meta) meta.terrainTag = 1;
    tileset.terrain = [...(tileset.terrain ?? [])];
    tileset.terrain[tile] = 1;
    project.database.terrains = [{ id: "t1", damage: 0, encounterRatePercent: 0, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: false }, ...terrain }];
    if (cues) project.system.seCues = cues;
    return project;
  }

  it("지형 기록의 발소리 → 지형 이름의 footstep 자리 → 없음", () => {
    const at = (p: Project) => ({ mapId: Object.keys(p.maps)[0]!, x: 0, y: 0 });
    const own = steppingProject({ name: "풀밭", footstepSoundResourceId: "snd_own" }, { "footstep-grass": "snd_grass" });
    expect(footstepResourceAt(own, at(own))).toBe("snd_own");
    const named = steppingProject({ name: "풀밭" }, { "footstep-grass": "snd_grass" });
    expect(footstepResourceAt(named, at(named))).toBe("snd_grass");
    const silent = steppingProject({ name: "풀밭" });
    expect(footstepResourceAt(silent, at(silent))).toBeUndefined();
    expect(footstepCueForTerrain("눈 덮인 길")).toBe("footstep-snow");
  });

  it("발소리는 간격 안에 한 번만, 걸린 소리가 없으면 내지 않는다", () => {
    resetFootstepClock();
    const project = steppingProject({ name: "돌길", footstepSoundResourceId: "snd_step" });
    const at = { mapId: Object.keys(project.maps)[0]!, x: 0, y: 0 };
    expect(playFootstep(project, at, 1000)).toBe(true);
    expect(playFootstep(project, at, 1000 + FOOTSTEP_MIN_INTERVAL_MS - 1)).toBe(false);
    expect(playFootstep(project, at, 1000 + FOOTSTEP_MIN_INTERVAL_MS)).toBe(true);
    resetFootstepClock();
    expect(playFootstep(steppingProject({ name: "돌길" }), at, 5000)).toBe(false);
  });
});
