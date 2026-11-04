/**
 * 『폴른 스타』 전투 음악(2026-11-04 소리 재고): 전투 76개(맵 22개) 중 75개가 보스곡 재의 왕관(btl-002) 하나였다.
 * 번들 CC0 카탈로그에서 전투로 들리는 곡은 둘뿐이라(소리 판정자: 지역 후보 1~2점 「평화로운 마을 곡」) 오너가 허락한
 * OPRN BGM(Google Lyria, 가사 없음)을 지역마다 들여 배치했다. 곡은 두 구간씩 듣고 지역 적합도를 매겼다(1~5).
 * - 일반 전투: 지역 맵 전투곡(GameMap.battleBgmResourceId — 런타임이 이벤트 덮어쓰기 > 맵 > 프로젝트 순으로 튼다).
 * - 보스·우두머리·막 마지막 보스: 그 전투 직전에 시스템 전투곡을 바꾸고 끝나면(이기든 지든) 되돌린다(m2-027 cue battle).
 * 모든 전투가 다 놓인 뒤에 한 번 돈다 — 장마다 흩어져 있던 덮어쓰기는 여기로 모았다.
 */
import type { Command, GameEvent, Project } from "@/project/types";

type CommandList = Command[];

export const FS_BATTLE_DEFAULT = "oprn-bgm-dfk-battlefield-v0-0";
export const FS_BATTLE_BOSS = "oprn-bgm-dfk-boss-v1-0";
export const FS_BATTLE_ACT_FINAL = "oprn-bgm-ct2-finalboss-v0-1";

const FOREST = "oprn-bgm-ct2-battle-v1-1";
const VAULT = "oprn-bgm-gal-portraitboss-v0-1";
const NIGHT = "oprn-bgm-dfk-battlefield-v1-1";
const NORTH = "oprn-bgm-dfk-battlefield-v0-1";
const FORT = "oprn-bgm-dfk-battlefield-v0-0";
const TOWER = "oprn-bgm-dfk-boss-v0-0";

export const FS_AREA_BATTLE_BGM: Readonly<Record<string, string>> = {
  fs_forest: FOREST, fs_forest_edge: FOREST, fs_forest_stream: FOREST, fs_forest_thicket: FOREST, fs_forest_glade: FOREST, fs_forest_shrine: FOREST,
  fs_vault: VAULT, fs_vault_b3: VAULT, fs_vault_b4: VAULT,
  fs2_hub_night: NIGHT,
  map_field_north_1: NORTH, map_field_north_2: NORTH, fs2_dawnwell: NORTH,
  fs2_fort_court: FORT, fs2_fortress: FORT, fs2_fortress_f2: FORT,
  map_snow_north_1: NORTH, map_snow_north_2: NORTH, fs2_ice_lake: NORTH,
  fs2_sky_tower: TOWER, fs2_sky_tower_f2: TOWER, fs2_sky_tower_f3: TOWER, fs2_sky_tower_top: TOWER,
};

export const FS_ACT_FINAL_TROOPS: readonly string[] = ["troop_fs_valen_squad", "troop_fs_valen_crash", "troop_fs2_ash_collector"];

export const FS_BOSS_TROOPS: readonly string[] = [
  "troop_fs_dragon",
  "troop_fs_elite_thornback",
  "troop_fs_inq_penance",
  "troop_fs2_cinder_golem",
  "troop_fs2_elite_warden",
  "troop_fs2_elite_frost",
  "troop_fs2_tower_sentinel",
  "troop_fs2_sarah",
];

const BATTLE_CUE = "m2-027-change-system-bgm";
const cue = (fields: Record<string, string>): Command =>
  ({ kind: "m2Command", commandId: BATTLE_CUE, fields: { cue: "battle", ...fields } }) as unknown as Command;
const isBattleCue = (c: Command): boolean => {
  const m = c as unknown as { kind?: string; commandId?: string; fields?: { cue?: string } };
  return m.kind === "m2Command" && m.commandId === BATTLE_CUE && m.fields?.cue === "battle";
};

function forEachList(list: CommandList, visit: (l: CommandList) => void): void {
  visit(list);
  for (const c of list) {
    for (const value of Object.values(c as unknown as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      if (value.every((v) => v && typeof v === "object" && "kind" in v)) forEachList(value as CommandList, visit);
      else for (const opt of value) if (opt && typeof opt === "object" && Array.isArray((opt as { branch?: unknown }).branch)) forEachList((opt as { branch: CommandList }).branch, visit);
    }
  }
}

function allLists(project: Project): CommandList[] {
  const out: CommandList[] = [];
  const ofEvent = (e: GameEvent) => {
    if (e.commands) forEachList(e.commands, (l) => out.push(l));
    for (const p of e.pages ?? []) forEachList(p.commands, (l) => out.push(l));
  };
  for (const map of Object.values(project.maps)) map.events.forEach(ofEvent);
  for (const ce of project.commonEvents ?? []) forEachList((ce as unknown as { commands?: CommandList }).commands ?? [], (l) => out.push(l));
  return out;
}

export function applyFallenBattleMusic(project: Project): void {
  project.system.battleBgmResourceId = FS_BATTLE_DEFAULT;
  for (const [mapId, resourceId] of Object.entries(FS_AREA_BATTLE_BGM)) {
    const map = project.maps[mapId];
    if (!map) throw new Error(`[fallen-star] 전투곡 맵이 없다: ${mapId}`);
    map.battleBgmResourceId = resourceId;
  }
  const bossCue = new Map<string, string>([...FS_BOSS_TROOPS.map((id) => [id, FS_BATTLE_BOSS] as const), ...FS_ACT_FINAL_TROOPS.map((id) => [id, FS_BATTLE_ACT_FINAL] as const)]);
  let wrapped = 0;
  for (const list of allLists(project)) {
    if (list.some(isBattleCue)) throw new Error("[fallen-star] 전투곡 덮어쓰기는 battleMusic.ts 한곳에서만 건다 — 다른 곳에 남은 m2-027 cue battle 을 지워라");
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const c = list[i] as unknown as { kind: string; troopId?: string };
      const resourceId = c.troopId ? bossCue.get(c.troopId) : undefined;
      if (c.kind !== "battleProcessing" || !resourceId) continue;
      list.splice(i + 1, 0, cue({ operation: "reset" }));
      list.splice(i, 0, cue({ operation: "set", resourceId, volume: "100" }));
      wrapped += 1;
    }
  }
  const placed = new Set<string>();
  for (const list of allLists(project)) for (const c of list) {
    const b = c as unknown as { kind: string; troopId?: string };
    if (b.kind === "battleProcessing" && b.troopId && bossCue.has(b.troopId)) placed.add(b.troopId);
  }
  const missing = [...bossCue.keys()].filter((id) => !placed.has(id));
  if (missing.length || wrapped === 0) throw new Error(`[fallen-star] 보스곡 부대의 전투를 찾지 못했다: ${missing.join(", ")}`);
}
