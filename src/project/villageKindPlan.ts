// 마을 종류 기록 — 버들항 마을 빌더가 «어느 종류로 지었고 어떤 장면이 어디 섰는지» 를 맵의 빌더 설계 기록(layoutPlan)에 남기고, 읽는 쪽이 꺼내 본다.
// 종류는 layoutPlan.kind 에(«beodeul-village:<종류 id>»), 장면은 role "scene" 영역으로. 종류 표는 editor/tools/beodeulVillageKinds.ts 에 있다 —
// 이 파일은 표를 모른다(자리 낱말·검사처럼 맵만 읽는 쪽이 표를 끌어오지 않게).
import type { GameMap, MapLayoutPlan, MapLayoutRegion, Project } from "./types";

const PLAN_PREFIX = "beodeul-village:";
export const VILLAGE_SCENE_ROLE = "scene";

export interface VillageSceneRecord {
  readonly id: string; readonly ko: string; readonly en: string; readonly at: string;
  readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  /** 사람이 설 칸(장면 곁의 빈 땅). */
  readonly stand: { x: number; y: number };
}

/** 그 맵이 어느 종류로 지어졌나. */
export function villageKindOfMap(map: Pick<GameMap, "layoutPlan"> | undefined): string | undefined {
  const k = map?.layoutPlan?.kind;
  return k?.startsWith(PLAN_PREFIX) ? k.slice(PLAN_PREFIX.length) : undefined;
}
/** 이 프로젝트의 다른 마을이 쓴 종류 — 한 게임의 마을 셋이 세 종류가 되게. */
export function villageKindsTaken(project: Pick<Project, "maps">, exceptMapId: string): Set<string> {
  const out = new Set<string>();
  for (const m of Object.values(project.maps)) { const k = m.id === exceptMapId ? undefined : villageKindOfMap(m); if (k) out.add(k); }
  return out;
}
/** 다시 짓기 전에 옛 종류 기록을 걷는다(집 보호 영역 같은 남의 기록은 둔다). */
export function clearVillageKindPlan(map: GameMap): void {
  if (!map.layoutPlan) return;
  const mine = villageKindOfMap(map) !== undefined;
  const regions = map.layoutPlan.regions.filter((r) => r.role !== VILLAGE_SCENE_ROLE);
  if (!mine && regions.length === map.layoutPlan.regions.length) return;
  if (regions.length || !mine) map.layoutPlan = { ...map.layoutPlan, ...(mine ? { kind: "houses" } : {}), regions }; else delete map.layoutPlan;
}
/** 종류와 선 장면을 맵에 적는다. */
export function recordVillageKind(map: GameMap, kind: { id: string; ko: string; en: string; rank: string }, seed: number, scenes: readonly VillageSceneRecord[]): void {
  const others = (map.layoutPlan?.regions ?? []).filter((r) => r.role !== VILLAGE_SCENE_ROLE);
  const plan: MapLayoutPlan = {
    version: 1, kind: `${PLAN_PREFIX}${kind.id}`, seed,
    regions: [...others, ...scenes.map((s): MapLayoutRegion => ({ id: `scene_${s.id}`, role: VILLAGE_SCENE_ROLE, label: s.ko, x: s.x, y: s.y, w: s.w, h: s.h, tags: [kind.id, s.id, s.en, s.at], front: s.stand }))],
    notes: `${kind.ko} (${kind.en}) — ${kind.rank}`,
  };
  map.layoutPlan = plan;
}
/** 맵에 적힌 장면들. */
export function villageScenesOfMap(map: Pick<GameMap, "layoutPlan"> | undefined): MapLayoutRegion[] {
  return (map?.layoutPlan?.regions ?? []).filter((r) => r.role === VILLAGE_SCENE_ROLE);
}
/** 자리 낱말이 가리키는 장면 — 이름(한국어·영어)이 낱말에 들어 있는 것 가운데 가장 긴 이름. */
export function villageSceneByWord(map: Pick<GameMap, "layoutPlan">, word: string | undefined): MapLayoutRegion | undefined {
  const w = (word ?? "").trim().toLowerCase();
  if (!w) return undefined;
  let best: MapLayoutRegion | undefined, len = 0;
  for (const r of villageScenesOfMap(map)) for (const name of [r.label, r.tags?.[2] ?? ""]) { const n = name.toLowerCase(); if (n && w.includes(n) && n.length > len) { best = r; len = n.length; } }
  return best;
}
