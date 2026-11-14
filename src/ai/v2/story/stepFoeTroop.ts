// 싸우는 단계의 상대 무리 고르기 — 장소 테마의 현행 그림 종에서(place/placeTheme), 상대 이름을 단 사본으로. blueprintPath 가 지을 때, 끝맺음(step-foes)이 옛 판의 그림 없는 상대를 다시 고를 때 쓴다.
import type { Project } from "@/project/types";
import { themeBossTroop } from "../place/placeTheme";
import { pickFittedTroops } from "@/editor/tools/jrpgVolumeTools";
import { FITTED_TROOP_PREFIX } from "@/editor/tools/bossThreatScaling";

/**
 * 싸우는 단계의 상대 무리 — 시작 파티에 맞춘 보스(마지막 싸움)·중간 보스 사본. 상대 이름(who)이 있으면 그 이름을 단 사본을 단계마다 하나 둔다
 * (원본 DB 적은 그대로, 다시 지으면 같은 사본을 고쳐 쓴다). 전투 화면의 적 이름이 청사진의 그 사람이 된다.
 * taken = 이 게임의 싸우는 단계들이 세운 종(부르는 쪽이 단계마다 같은 집합을 넘긴다) — 보스 둘이 같은 전투 그림으로 서지 않게 고르고, 고른 종을 더한다.
 */
export function foeTroop(project: Project, stepId: string, who: string | undefined, final: boolean, mapId: string, salt: number, gaps: string[], taken?: Set<string>): string | undefined {
  // 그 장소의 테마에 맞는 상대가 먼저다(사막 유적의 수호자가 늘 «붉은 드래곤» 사본이었다) — 현행 그림이 있는 종에서 고른다(place/placeTheme).
  // 그런 적이 프로젝트 DB 에 하나도 없을 때만(적을 다 바꾼 프로젝트) 종전대로 DB 에서 가장 센 무리.
  const themed = themeBossTroop(project, mapId, who, final, salt, taken);
  gaps.push(...themed.gaps);
  if (themed.enemyId) taken?.add(themed.enemyId);
  const picked = themed.troopId ? undefined : pickFittedTroops(project, undefined);
  const baseId = themed.troopId ?? (final ? picked!.boss : picked!.midBoss) ?? picked!.boss ?? picked!.midBoss ?? picked!.field.at(-1);
  const name = who?.trim();
  const source = project.database.troops.find((t) => t.id === baseId);
  if (!baseId || !source || !name) return baseId;
  const key = stepId.replace(/[^A-Za-z0-9]+/gu, "_").toLowerCase() || "s";
  const id = `${FITTED_TROOP_PREFIX}foe_${key}`, enemyCopyId = `enemy_fit_foe_${key}`;
  const members = (source.members?.length ? source.members.map((m) => m.enemyId) : source.enemyIds) ?? [];
  const lead = project.database.enemies.find((e) => e.id === members[0]);
  if (!lead) return baseId;
  const enemy = { ...structuredClone(lead), id: enemyCopyId, name } as typeof lead;
  const troop = structuredClone(source) as typeof source;
  (troop as { id: string }).id = id;
  (troop as { name?: string }).name = name;
  // 이름은 앞장선 하나만 — 같은 적이 여럿인 무리에서 모두가 그 사람이 되지 않게.
  let renamed = false;
  const swap = (enemyId: string): string => { if (renamed || enemyId !== lead.id) return enemyId; renamed = true; return enemyCopyId; };
  (troop as { enemyIds: string[] }).enemyIds = (source.enemyIds ?? members).map(swap);
  renamed = false;
  if (source.members?.length) (troop as { members: unknown[] }).members = source.members.map((m) => ({ ...m, enemyId: swap(m.enemyId) }));
  const put = <T extends { id: string }>(list: T[], row: T) => { const i = list.findIndex((x) => x.id === row.id); if (i >= 0) list[i] = row; else list.push(row); };
  put(project.database.enemies as { id: string }[], enemy);
  put(project.database.troops as { id: string }[], troop);
  return id;
}

/**
 * 길 위에 이미 선 적(단계의 상대가 아닌 맵 이벤트·조우표·필드 스폰의 무리)과 전투 그림이 같은 적 전부 — 싸우는 단계의 «쓴 종» 에 넣는다.
 * 왜(2026-11-13 r3b-fun): 마지막 보스 «그림자 종지기» 가 길목의 «광산의 돌 골렘» 과 같은 돌 골렘 그림이었다.
 */
export function roadFoeSpecies(project: Project): string[] {
  const troopIds = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { for (const item of node) walk(item); return; }
    if (!node || typeof node !== "object") return;
    const cmd = node as { kind?: string; troopId?: unknown };
    if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") troopIds.add(cmd.troopId);
    for (const value of Object.values(node)) if (value && typeof value === "object") walk(value);
  };
  for (const map of Object.values(project.maps)) {
    walk(map.events);
    for (const entry of map.encounterTable ?? []) troopIds.add(entry.troopId);
    for (const id of map.troopIds ?? []) troopIds.add(id);
    for (const spawn of map.fieldSpawns ?? []) troopIds.add(spawn.troopId);
  }
  const stepFoe = `${FITTED_TROOP_PREFIX}foe_`;
  const pictures = new Set<string>();
  for (const troop of project.database.troops) {
    // 단계의 상대(사본 troop_fit_foe_* 와 그 길 사본)는 길 적이 아니다 — 다시 지을 때 제 종을 스스로 막지 않게.
    if (!troopIds.has(troop.id) || troop.id.includes(stepFoe.replace(/^troop_/u, ""))) continue;
    for (const enemyId of troop.enemyIds ?? []) { const picture = (project.database.enemies.find((e) => e.id === enemyId) as { monsterResourceId?: string } | undefined)?.monsterResourceId; if (picture) pictures.add(picture); }
  }
  return project.database.enemies.filter((e) => pictures.has((e as { monsterResourceId?: string }).monsterResourceId ?? "")).map((e) => e.id);
}
