// 캠페인 규모(체육관 수)를 인자로 받는다. 기본(8관)은 기존 90맵 캠페인과 한 글자도 다르지 않다.
//
// 이전에는 build_monster_game 이 늘 72맵·60종·8체육관·142연결을 만들고 검수도 그 상수로 막았다 —
// 「체육관 3개」「체육관 없이」를 말해도 8관 캠페인으로 바뀌어 나왔다(2026-10-14 자유도 감사).
// 여기서 정한 모양이 만드는 쪽(world.ts)과 검수 하한(monsterGameReview.ts)의 한 출처다.
import type { MonsterCampaignPlan } from "@/project/types/database";

export const FULL_GYMS = 8;
/** 기존 검수 상수 — 계획(plan)이 없는 옛 저장본의 하한. 새 캠페인은 plan 을 들고 태어난다. */
export const LEGACY_CAMPAIGN_PLAN: MonsterCampaignPlan = { gyms: 8, species: 60, maps: 72, links: 142 };
// 기본 캠페인 실측(90맵·351방향)에 대한 72·142 하한의 비율 — 다른 규모도 같은 여유를 둔다.
const FULL_BUILT_MAPS = 90;
const FULL_BUILT_LINKS = 351;

export function clampGymCount(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : FULL_GYMS;
  return Math.max(0, Math.min(FULL_GYMS, n));
}

/** 만든 결과에서 검수 하한을 정한다. 기본 캠페인이면 정확히 72맵·142연결·60종·8관. */
export function planFromBuilt(counts: { readonly gyms: number; readonly species: number; readonly maps: number; readonly links: number }): MonsterCampaignPlan {
  return {
    gyms: counts.gyms,
    species: counts.species,
    maps: Math.floor(counts.maps * 72 / FULL_BUILT_MAPS),
    links: Math.floor(counts.links * 142 / FULL_BUILT_LINKS),
  };
}

const WORDS = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟"];
/** 「여덟 빛의 약속」 같은 서술 속 수. */
export function gymWord(count: number): string { return WORDS[Math.max(1, Math.min(count, FULL_GYMS))]!; }

/** 규모 N 의 뼈대. 마을 [0..finalTown], 길 [0..finalTown-1], 체육관은 마을 1..N(0관은 체육관 없는 마을 둘). */
export interface CampaignShape {
  readonly gyms: number;
  /** 마지막 마을 인덱스 — 관측탑·리그가 붙는 곳. 8관=용마루 시티(8), 0관=항구(2). */
  readonly finalTown: number;
  /** 리그 방 수 — 7·8관 5, 4~6관 3, 1~3관 1(챔피언만), 0관 0(관측탑 보스가 엔딩). */
  readonly leagueRooms: number;
  /** 프리즘 시티(4번 마을)가 있으면 박물관, 5관부터 밤막회사 지부(구출 목표·사막 길 잠금). */
  readonly museum: boolean;
  readonly hideout: boolean;
}

export function campaignShape(gymsInput: number): CampaignShape {
  const gyms = clampGymCount(gymsInput);
  return {
    gyms,
    finalTown: gyms >= 1 ? gyms : 2,
    leagueRooms: gyms >= 7 ? 5 : gyms >= 4 ? 3 : gyms >= 1 ? 1 : 0,
    museum: gyms >= 4,
    hideout: gyms >= 5,
  };
}

// ─── 레벨 곡선 ─────────────────────────────────────────────────────────────
// 본래 곡선(8관): 체육관 9·14·19·24·30·36·42·48, 길 4·10·15·20·26·32·38·44.
const GYM_LEVELS = [9, 14, 19, 24, 30, 36, 42, 48] as const;
// 마지막 체육관 레벨 — 짧은 캠페인은 끝 레벨을 낮춰 한 판에 닿게 한다(1관은 첫 체육관 9 그대로).
const TOP_GYM_LEVEL: Readonly<Record<number, number>> = { 1: 9, 2: 16, 3: 21, 4: 26, 5: 32, 6: 38, 7: 43, 8: 48 };
const orig = (k: number): number => GYM_LEVELS[Math.max(0, Math.min(7, k - 1))]!;

export interface CampaignLevels {
  /** j번째(1..) 체육관·마을 레벨. */
  gym(j: number): number;
  /** j번째 길(마을 j-1 → j). */
  route(j: number): number;
  /** 마을 t 곁 부속 지역·지부 — 본래 레벨을 그 마을 레벨에 맞춰 옮긴다. */
  side(townIndex: number, original: number): number;
  /** 관측탑·리그·희귀 몬스터 — 본래 레벨(48 이후)을 마지막 체육관에 맞춰 옮긴다. */
  endgame(original: number): number;
}

export function campaignLevels(gymsInput: number): CampaignLevels {
  const gyms = clampGymCount(gymsInput);
  const full = gyms >= FULL_GYMS;
  const top = full ? 48 : gyms >= 1 ? TOP_GYM_LEVEL[gyms]! : 12;
  const gym = (j: number): number => {
    if (full || gyms <= 1) return orig(j);
    // 마을 j 를 본래 곡선의 위치(1..8)로 옮겨 보간한 뒤 끝 레벨에 맞춰 줄인다.
    const pos = 1 + (Math.min(j, gyms) - 1) * 7 / (gyms - 1), lo = Math.floor(pos), hi = Math.min(8, lo + 1);
    const base = orig(lo) + (orig(hi) - orig(lo)) * (pos - lo);
    return Math.round(9 + (base - 9) * (top - 9) / (48 - 9));
  };
  return {
    gym,
    route: j => full ? [4, 10, 15, 20, 26, 32, 38, 44][Math.min(7, j - 1)]! : j <= 1 ? 4 : Math.max(5, gym(j) - 4),
    side: (t, original) => full ? original : Math.max(5, gym(t) + (original - orig(t))),
    // 본래 곡선의 끝(48 이후: 관측탑·리그 방 50~58·희귀 몬스터 55)은 마지막 체육관 위로 최대 +10 이다 — 그 +10 은 체육관 8곳·길·사천왕 방 넷을 지나며 쌓인 경험을 전제로 한 값이다.
    // 3관 캠페인에서 그대로 두면 챔피언(6마리)이 마지막 관장(21)보다 10 높은 31 이라 한 판에서 자라는 파티가 못 닿는다(2026-10-16 깊이 감사 c2: 자동 플레이 3회 모두 챔피언 패배).
    // 체육관 곡선(gym())과 같은 비율 (top-9)/(48-9) 로 그 위쪽 간격도 줄인다. 사천왕 방이 없는 1~3관은 챔피언이 관측탑 바로 뒤라 중간에 키울 방이 없어 간격을 4분의 3 으로 더 줄인다
    // (실측 3관: 챔피언 6마리 Lv23·24 통과, Lv25 패배 — 여유를 두고 23). 8관은 full 분기라 본래 곡선 그대로.
    endgame: original => full ? original : Math.max(10, top + Math.round((original - 48) * (top - 9) / (48 - 9) * (campaignShape(gyms).leagueRooms >= 3 ? 1 : 0.75))),
  };
}

/** 계획을 사람 말로 — 도구 결과·프롬프트·보고서가 같은 문장을 쓴다. */
export function describePlan(plan: MonsterCampaignPlan): string {
  return `체육관 ${plan.gyms}·종 ${plan.species}·맵 ${plan.maps}+·연결 ${plan.links}+`;
}

const GYMLESS_PHRASES: readonly (readonly [string, string])[] = [
  ["여덟 빛의 약속", "별빛의 약속"],
  ["여덟 지역의 약속을 모아, 빛을", "섬 곳곳을 탐험하며, 빛을"],
  ["별빛섬의 여덟 등불", "별빛섬의 등불"],
  ["여덟 관장의 약속을 모아 보렴", "섬 곳곳을 걸으며 도감을 채워 보렴"],
  ["여덟 지역이 서로 돌볼 때", "섬의 모든 생명이 서로 돌볼 때"],
];

/** 서사 속 「여덟」을 규모에 맞게 고쳐 쓴다 — 3관 캠페인의 타이틀이 「여덟 빛의 약속」이면 요청을 바꿔 치운 것이다. */
export function retellForGymCount(project: unknown, gymsInput: number): number {
  const gyms = clampGymCount(gymsInput);
  if (gyms >= FULL_GYMS) return 0;
  let changed = 0;
  const retell = (text: string): string => {
    if (!text.includes("여덟")) return text;
    let next = text;
    if (gyms > 0) next = next.replaceAll("여덟", gymWord(gyms));
    else {
      for (const [from, to] of GYMLESS_PHRASES) next = next.replaceAll(from, to);
      next = next.replaceAll("여덟 ", "모든 ");
    }
    if (next !== text) changed++;
    return next;
  };
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return retell(value);
    if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) value[i] = walk(value[i]); return value; }
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        if (key === "dataUrl" || key === "src" || key === "url" || key === "ref") continue;
        (value as Record<string, unknown>)[key] = walk((value as Record<string, unknown>)[key]);
      }
    }
    return value;
  };
  const record = project as Record<string, unknown>;
  for (const key of ["maps", "database", "system", "commonEvents", "meta", "endings"]) walk(record[key]);
  return changed;
}
