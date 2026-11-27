// 출하 기본값 — 지역(맵)·보스별 전투곡. 차례는 shipLookDefaults.fillBattleBgm 이 프로젝트 전투곡을 고른 뒤 부른다.
// 왜(2026-11-26 전투 소리 다양성 분석): 조수가 만든 일반 RPG 41종의 85% 가 모든 전투에 한 곡을 틀었다(맵 단위 전투곡 0종, 보스곡 덮어쓰기 6종).
// 런타임은 이미 이벤트 덮어쓰기(보스) > 맵 전투곡 > 프로젝트 전투곡 순으로 읽는다(project/mapMusic.ts resolveBattleBgmResourceId) — 비어 있던 것은 값이다.
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { OPRN_BGM_ASSETS } from "@/assets/oprnBgmAssets";
import { climateBattleBackground, dungeonBattleBackground, isForestNamedMap, placeNameBattleBackground } from "@/battle/battleBackdrop";
import { setBossBattleMusic } from "@/editor/tools/musicAuthoringTools";
import type { Project } from "@/project/types";
import { allCommands, encounterMaps } from "../judge/combatChecks";
import { looksLikeBoss } from "../judge/audioVarietyLint";

export type BattleRegion = "forest" | "snow" | "dungeon" | "desert" | "other";

const BOSS_CUE = "m2-027-change-system-bgm";
const FINAL_BOSS_NAME = /마왕|최종|대마왕|魔王|final/iu;

/** 지역 종류별 어울리는 일반 전투곡(oprnBgmAssets.ts 의 brief 와 『폴른 스타』 지역 배치 기록 기준). 모르는 지역은 곡 목록을 돌려 쓴다. */
const REGION_TRACK: Readonly<Record<Exclude<BattleRegion, "other">, string>> = {
  forest: "oprn-bgm-ct2-battle-v1-1",
  snow: "oprn-bgm-dfk-battlefield-v0-1",
  dungeon: "oprn-bgm-dfk-battlefield-v1-1",
  desert: "oprn-bgm-dfk-battlefield-v0-0",
};
const BOSS_ROTATION: readonly string[] = ["oprn-bgm-dfk-boss-v1-0", "oprn-bgm-dfk-boss-v0-0", "oprn-bgm-gal-portraitboss-v0-1"];
const FINAL_BOSS_TRACK = "oprn-bgm-ct2-finalboss-v0-1";

/** 같은 입력 → 같은 값(파일 안 열쇠로 곡을 돌려 쓴다). */
export function stableHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  // 끝 섞기(murmur3 fmix) — 글자 하나만 다른 제목이 같은 쪽으로 몰리지 않게.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

export function battleRegionOf(project: Project, mapId: string): BattleRegion {
  if (climateBattleBackground(project, mapId)) return "snow";
  if (isForestNamedMap(project, mapId)) return "forest";
  if (dungeonBattleBackground(project, mapId)) return "dungeon";
  return placeNameBattleBackground(project, mapId) === "battle-scenery-desert" ? "desert" : "other";
}

/** 전투가 나는 맵: 무작위 조우·필드 적 스폰·이벤트 전투(battleProcessing). */
function battleMapIds(project: Project): string[] {
  const out = new Set<string>(encounterMaps(project));
  for (const map of Object.values(project.maps)) if ((map.fieldSpawns?.length ?? 0) > 0) out.add(map.id);
  for (const r of allCommands(project)) if (r.cmd.kind === "battleProcessing" && project.maps[r.mapId]) out.add(r.mapId);
  return Object.keys(project.maps).filter((id) => out.has(id));
}

/**
 * 전투가 나는 맵이 둘 이상이면 맵마다 일반 전투곡을, 보스 부대에는 보스곡을 건다. 저작자가 이미 건 맵 전투곡·보스 덮어쓰기는 건드리지 않는다.
 * 곡은 이 프로젝트에서 실제로 쓸 수 있는 목록(listAudioResources)의 OPRN 전투곡만 쓴다 — 없으면 아무것도 하지 않는다.
 */
export function fillRegionBattleBgm(project: Project): string[] {
  const out: string[] = [];
  const available = new Set(listAudioResources("music", project).map((r) => r.id));
  const pool = OPRN_BGM_ASSETS.filter((a) => a.scenes.length === 1 && a.scenes[0] === "battle" && available.has(a.id)).map((a) => a.id);
  const maps = battleMapIds(project);
  if (pool.length && maps.length >= 2) {
    for (const mapId of maps) {
      const map = project.maps[mapId]!;
      if (map.battleBgmResourceId?.trim()) continue;
      const region = battleRegionOf(project, mapId);
      const wanted = region === "other" ? undefined : REGION_TRACK[region];
      const pick = wanted && pool.includes(wanted) ? wanted : pool[stableHash(mapId) % pool.length]!;
      map.battleBgmResourceId = pick;
      out.push(`전투 곡 ${map.name || mapId} → ${pick}`);
    }
  }
  if (!JSON.stringify(project.maps).includes(BOSS_CUE) && !JSON.stringify(project.commonEvents ?? []).includes(BOSS_CUE)) {
    const fought = new Set<string>();
    const order: string[] = [];
    for (const r of allCommands(project)) {
      const troopId = r.cmd.kind === "battleProcessing" && typeof r.cmd.troopId === "string" ? r.cmd.troopId : undefined;
      if (troopId && !fought.has(troopId)) { fought.add(troopId); if (looksLikeBoss(project, troopId)) order.push(troopId); }
    }
    const bosses = BOSS_ROTATION.filter((id) => available.has(id));
    let turn = 0;
    for (const troopId of order) {
      const name = project.database.troops.find((t) => t.id === troopId)?.name ?? "";
      const finalTrack = available.has(FINAL_BOSS_TRACK) && FINAL_BOSS_NAME.test(name) ? FINAL_BOSS_TRACK : undefined;
      const pick = finalTrack ?? (bosses.length ? bosses[turn++ % bosses.length] : undefined);
      if (!pick) continue;
      if (setBossBattleMusic(project, pick, [troopId]).length) out.push(`보스곡 ${name || troopId} → ${pick}`);
    }
  }
  return out;
}
