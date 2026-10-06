import type { Project } from "@/project/types";

// 기획서의 고유명을 공용 캠페인에 입힌다 — 조수가 「솔바람 마을」·「바위 체육관 관장 단단」을 받아도
// 캠페인은 늘 「별싹 마을」·「유림」이었다(2026-10-06 qa:game monster-collect). 진행·전투는 그대로 두고 이름만 바꾼다.
export interface CampaignNames {
  region?: string;
  startTown?: string;
  professor?: string;
  firstRoute?: string;
  firstGym?: string;
  firstLeader?: string;
  firstBadge?: string;
}

const ORIGINAL: Required<CampaignNames> = {
  region: "별빛섬",
  startTown: "별싹 마을",
  professor: "천문박사",
  firstRoute: "1번길 · 별싹 들판",
  firstGym: "새순 체육관",
  firstLeader: "유림",
  firstBadge: "새잎 배지",
};

/** 이름만 바꾼다(아이디·자원 경로는 한글 고유명을 쓰지 않으므로 그대로). 바꾼 문자열 수를 돌려준다. */
export function renameCampaign(project: Project, names: CampaignNames): number {
  const pairs = (Object.keys(ORIGINAL) as (keyof CampaignNames)[])
    .map((key) => [ORIGINAL[key], names[key]?.trim()] as const)
    .filter((pair): pair is readonly [string, string] => !!pair[1] && pair[1] !== pair[0])
    // 긴 이름부터 — 「1번길 · 별싹 들판」 안의 「별싹」 같은 겹침을 먼저 처리한다.
    .sort((a, b) => b[0].length - a[0].length);
  if (pairs.length === 0) return 0;
  let changed = 0;
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      let next = value;
      for (const [from, to] of pairs) if (next.includes(from)) next = next.split(from).join(to);
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
  for (const key of ["maps", "database", "system", "commonEvents", "meta", "endings"] as const) walk((project as unknown as Record<string, unknown>)[key]);
  return changed;
}
