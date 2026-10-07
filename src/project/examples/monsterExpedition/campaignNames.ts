import type { Project } from "@/project/types";
import { EXPEDITION_GYMS } from "./worldPlan";

// 기획서의 고유명을 공용 캠페인에 입힌다 — 조수가 「솔바람 마을」·「바위 체육관 관장 단단」을 받아도
// 캠페인은 늘 「별싹 마을」·「유림」이었다(2026-10-06 qa:game monster-collect). 진행·전투는 그대로 두고 이름만 바꾼다.
export interface GymNames {
  name?: string;
  leader?: string;
  badge?: string;
}

export interface CampaignNames {
  region?: string;
  startTown?: string;
  professor?: string;
  firstRoute?: string;
  firstGym?: string;
  firstLeader?: string;
  firstBadge?: string;
  /** 1~8관 순서. firstGym/firstLeader/firstBadge 와 겹치면 이쪽이 이긴다. */
  gyms?: readonly GymNames[];
  /** 1번 도로 트레이너 직업명(최대 3) — 그 도로의 트레이너만 바꾼다. 같은 직업명이 다른 길에도 있어서 전체 치환하지 않는다. */
  firstRouteTrainers?: readonly string[];
}

const ORIGINAL = {
  region: "별빛섬",
  startTown: "별싹 마을",
  professor: "천문박사",
  firstRoute: "1번길 · 별싹 들판",
} as const;

const FIRST_ROUTE = "mx_map_meadow";

function hasFinalConsonant(word: string): boolean | null {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11_171) return null;
  return code % 28 !== 0;
}

function finalIsRieul(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11_171 && code % 28 === 8;
}

/** 바꾼 이름 뒤 조사를 받침에 맞춘다 — 「유림이」를 「사하라」로 바꾸면 「사하라이」가 됐다. */
function particleFor(to: string, particle: string): string {
  const batchim = hasFinalConsonant(to);
  if (batchim === null) return particle;
  const pairs: Record<string, [string, string]> = { 이: ["이", "가"], 가: ["이", "가"], 은: ["은", "는"], 는: ["은", "는"], 을: ["을", "를"], 를: ["을", "를"], 과: ["과", "와"], 와: ["과", "와"] };
  if (particle === "으로" || particle === "로") return batchim && !finalIsRieul(to) ? "으로" : "로";
  const pair = pairs[particle];
  return pair ? (batchim ? pair[0] : pair[1]) : particle;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** pairs 를 긴 이름부터 바꾸는 문자열 치환기. 바뀐 문자열 수를 센다. */
function replacer(pairs: readonly (readonly [string, string])[]) {
  const sorted = [...pairs].sort((a, b) => b[0].length - a[0].length);
  const patterns = sorted.map(([from, to]) => [new RegExp(`${escape(from)}(으로|로|이|가|은|는|을|를|과|와)?(?=[^가-힣]|$)|${escape(from)}`, "g"), from, to] as const);
  let changed = 0;
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      let next = value;
      for (const [pattern, , to] of patterns) next = next.replace(pattern, (_m, particle?: string) => to + (particle ? particleFor(to, particle) : ""));
      if (next !== value) changed += 1;
      return next;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) value[i] = walk(value[i]);
      return value;
    }
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        // 그림·소리 자원(data URI·경로)은 건드리지 않는다.
        if (key === "dataUrl" || key === "src" || key === "url") continue;
        (value as Record<string, unknown>)[key] = walk((value as Record<string, unknown>)[key]);
      }
    }
    return value;
  };
  return { walk, count: () => changed };
}

/** 이름만 바꾼다(아이디·자원 경로는 한글 고유명을 쓰지 않으므로 그대로). 바꾼 문자열 수를 돌려준다. */
export function renameCampaign(project: Project, names: CampaignNames): number {
  const pairs: [string, string][] = [];
  const add = (from: string, to: string | undefined) => { const next = to?.trim(); if (next && next !== from) pairs.push([from, next]); };
  // 1번길은 시작 테마가 이름을 바꿨을 수 있다(사막 = 「1번길 · 모래바람 길」) — 지금 맵 이름에서 바꾼다.
  for (const key of Object.keys(ORIGINAL) as (keyof typeof ORIGINAL)[]) add(key === "firstRoute" ? project.maps[FIRST_ROUTE]?.name ?? ORIGINAL[key] : ORIGINAL[key], names[key]);
  EXPEDITION_GYMS.forEach((gym, i) => {
    const given = names.gyms?.[i];
    // 시작 테마·관장 타입이 체육관 이름과 배지를 바꿨을 수 있다(서리꽃 마을 1관 = 「서리꽃 체육관」) — 지금 이름에서 바꾼다.
    add(project.maps[`mx_map_${gym.town}_gym`]?.name ?? gym.name, given?.name ?? (i === 0 ? names.firstGym : undefined));
    add(project.database.troops.find((troop) => troop.id === `mx_troop_mx_map_${gym.town}_gym_leader`)?.name ?? gym.leader, given?.leader ?? (i === 0 ? names.firstLeader : undefined));
    add(project.system.monsterCampaign?.badges?.[i]?.name ?? gym.badge, given?.badge ?? (i === 0 ? names.firstBadge : undefined));
  });
  let changed = 0;
  if (pairs.length) {
    const global = replacer(pairs);
    for (const key of ["maps", "database", "system", "commonEvents", "meta", "endings"] as const) global.walk((project as unknown as Record<string, unknown>)[key]);
    changed += global.count();
  }
  (names.firstRouteTrainers ?? []).slice(0, 3).forEach((to, i) => {
    const troop = project.database.troops.find((t) => t.id === `mx_troop_${FIRST_ROUTE}_trainer_${i}`);
    const event = project.maps[FIRST_ROUTE]?.events.find((e) => e.id === `${FIRST_ROUTE}_trainer_${i}`);
    if (!troop || !event || !to.trim() || troop.name === to.trim()) return;
    const local = replacer([[troop.name, to.trim()]]);
    local.walk(event);
    troop.name = to.trim();
    changed += local.count() + 1;
  });
  return changed;
}
