// 몬스터 수집 하네스(`monster-collect-species`)가 사람이 고른 그림으로 굽는 번들 — 런타임 입구.
//
// 규칙 하나: **번들 목록(`harnessMonsterBundle.json`, `npm run harness -- monster-collect-species build|manifest` 가 쓴다)에
// 종이 있고 시드의 `campaignSpeciesId` 가 캠페인 종 id 를 가리키면, 그 캠페인 종은 번들 그림을 쓴다.**
// 종마다 하드코딩하지 않는다 — 새 종을 사람이 골라 build 하면 목록이 늘고 캠페인이 자동으로 따라온다.
//
// 대응(캠페인 종 id ↔ 하네스 종 id)은 시드 `harness-data/monster-collect-species/seed.json` 의 종별 `campaignSpeciesId` 가 정본이다.
// 번들에 없는 종·면은 이 모듈이 아무것도 돌려주지 않으므로 호출자는 기존 그림(mx_art_*, generated-enemy-*)을 그대로 쓴다.
//
// 리소스 id: `harness-monster-<하네스종>-<front|back>`. 파일: `/assets/harnesses/monster-collect-species/<종>/<front|back>.png`(112×112),
// 대기 스트립 `<종>/anim/<면>-idle.png`(112×N 가로) — `battlerIdleAnimation()` 이 image-strip 으로 읽는다.
import bundle from "./harnessMonsterBundle.json";
import type { BattlerIdleAnimation } from "./battlerIdleAnimations";

export type HarnessMonsterSide = "front" | "back";

type BundleSide = { readonly idle?: { readonly frames: number; readonly frameMs: number } };
type BundleSpecies = { readonly campaignSpeciesId?: string; readonly front?: BundleSide; readonly back?: BundleSide };
type BundleFile = { readonly version: 1; readonly canvas: number; readonly species: Readonly<Record<string, BundleSpecies>> };

const FILE = bundle as BundleFile;
const BASE_PATH = "assets/harnesses/monster-collect-species";
const ID_PATTERN = /^harness-monster-([a-z][a-z0-9-]*)-(front|back)$/;

export function harnessMonsterResourceId(harnessSpeciesId: string, side: HarnessMonsterSide): string {
  return `harness-monster-${harnessSpeciesId}-${side}`;
}

function parse(resourceId: string | undefined): { readonly species: string; readonly side: HarnessMonsterSide } | undefined {
  const match = resourceId ? ID_PATTERN.exec(resourceId) : null;
  if (!match) return undefined;
  const species = match[1]!;
  const side = match[2] as HarnessMonsterSide;
  return Object.hasOwn(FILE.species, species) && FILE.species[species]![side] ? { species, side } : undefined;
}

/** 번들에 실제로 있는 면의 리소스 id 전부(참조 검증·편집기 목록용). */
export const HARNESS_MONSTER_RESOURCE_IDS: readonly string[] = Object.entries(FILE.species).flatMap(([species, entry]) =>
  (["front", "back"] as const).filter((side) => entry[side]).map((side) => harnessMonsterResourceId(species, side)));

/** 번들 그림의 URL(선행 슬래시). 번들에 없는 id 는 null — 호출자가 다른 해석기로 넘어간다. */
export function resolveHarnessMonsterUrl(resourceId: string): string | null {
  const parsed = parse(resourceId);
  return parsed ? `/${BASE_PATH}/${parsed.species}/${parsed.side}.png` : null;
}

/** 대기 스트립. 번들에 대기 칸이 없으면 undefined(정적 그림). */
export function harnessMonsterIdleAnimation(resourceId: string | undefined): BattlerIdleAnimation | undefined {
  const parsed = parse(resourceId);
  const idle = parsed ? FILE.species[parsed.species]![parsed.side]!.idle : undefined;
  if (!parsed || !idle) return undefined;
  return {
    resourceId: resourceId!,
    path: `${BASE_PATH}/${parsed.species}/anim/${parsed.side}-idle.png`,
    frameCount: idle.frames,
    cellWidth: FILE.canvas,
    cellHeight: FILE.canvas,
    frameDurationMs: idle.frameMs,
    tier: "image-strip",
  };
}

/** 캠페인 종 id → 번들 그림. 이어진 하네스 종이 없거나 그 면이 번들에 없으면 해당 필드가 비어 있다. */
export function harnessArtForCampaignSpecies(campaignSpeciesId: string): { readonly front?: string; readonly back?: string } {
  for (const [species, entry] of Object.entries(FILE.species)) {
    if (entry.campaignSpeciesId !== campaignSpeciesId) continue;
    return {
      ...(entry.front ? { front: harnessMonsterResourceId(species, "front") } : {}),
      ...(entry.back ? { back: harnessMonsterResourceId(species, "back") } : {}),
    };
  }
  return {};
}
