import { BATTLER_HIRES_SHEETS } from "@/assets/battlerHiresSheets";
import { BATTLER_IDLE_ANIMATIONS } from "@/assets/battlerIdleAnimations";
import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import { hasLifeLedgerData } from "@/player/lifeLedger";
import { PLAYER_RUNTIME_ASSET_PATHS } from "@/project/playerDeploymentManifest";
import type { Project } from "@/project/types";

// 등록되지 않은 런타임 에셋은 **항상** 실린다 — 기본값이 안전한 쪽이다.
// 덜어내지 않은 큰 것들의 이유(다시 지우려 들지 않도록):
// (옛 기본 배경 generated/battle-reference-forest.png 2.20MB 는 2026-10-03 deprecated/ 로 옮겼다 — 기본 배경은
//  도트 겹 배경이고 webExportAssets 가 그 네 장을 싣는다.)
// - assets/fonts/*.woff2 (1.05MB) 는 CSS 가 참조하는 UI 픽셀 폰트라 모든 화면이 쓴다.
interface ConditionalRuntimeAssetGroup {
  readonly reason: string;
  readonly paths: readonly string[];
  readonly needed: (project: Project) => boolean;
}

const CONDITIONAL_RUNTIME_ASSET_GROUPS: readonly ConditionalRuntimeAssetGroup[] = [
  {
    reason: "생활 원장 탭 아트 — 그 데이터가 없으면 탭 자체가 열리지 않는다",
    paths: Object.values(FARMING_LIFE_UI_ASSETS).map(stripLeadingSlash),
    needed: hasLifeLedgerData,
  },
  {
    // 영웅 전투 시트의 고해상도 짝·idle 스트립은 리소스 id 가 아니라 **경로**로만 참조된다
    // (battlerHiresSheets.ts / battlerIdleAnimations.ts 카탈로그). 리소스 id 스캔(collectWebExportAssets)에
    // 잡히지 않으므로 여기서 실어야 한다 — 빠지면 내보낸 게임의 사이드뷰 전투에서 영웅이 빈 상자가 된다.
    reason: "영웅 전투 시트 고해상도 짝 + idle 스트립 — 생성 영웅 시트를 쓰는 액터가 없으면 필요 없다",
    paths: [
      ...BATTLER_HIRES_SHEETS.map((entry) => entry.path),
      ...BATTLER_IDLE_ANIMATIONS.filter((entry) => entry.tier === "sheet-cell").map((entry) => entry.path),
      // 48px 원본 idle 스트립 — 고해상도 짝이 등록되지 않은 환경(옵트아웃)이 되돌아갈 자리다.
      ...[1, 2, 3, 4, 5, 6].map((index) => `assets/generated/starter/idle/hero-0${index}-battle.png`),
    ].filter((path, index, all) => all.indexOf(path) === index),
    needed: usesGeneratedHeroBattlers,
  },
];

/** 액터 어느 하나라도 생성 영웅 전투 시트(또는 레거시 별칭 `hero`)를 쓰는가. */
export function usesGeneratedHeroBattlers(project: Project): boolean {
  const ids = new Set(BATTLER_HIRES_SHEETS.map((entry) => entry.resourceId));
  return project.database.actors.some((actor) => actor.battleCharacterResourceId !== undefined && ids.has(actor.battleCharacterResourceId));
}

/** 이 프로젝트에서 **빼도 되는** 런타임 에셋 — 조건부 그룹이 명시적으로 지목한 것만이다. */
export function prunedRuntimeAssetPaths(project: Project): ReadonlySet<string> {
  const skipped = new Set<string>();
  for (const group of CONDITIONAL_RUNTIME_ASSET_GROUPS) {
    if (group.needed(project)) continue;
    for (const path of group.paths) skipped.add(path);
  }
  return skipped;
}

export function requiredRuntimeAssetPaths(project: Project): ReadonlySet<string> {
  const skipped = prunedRuntimeAssetPaths(project);
  return new Set(PLAYER_RUNTIME_ASSET_PATHS.filter((path) => !skipped.has(path)));
}

export function conditionalRuntimeAssetPaths(): readonly string[] {
  return CONDITIONAL_RUNTIME_ASSET_GROUPS.flatMap((group) => group.paths);
}

function stripLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}
