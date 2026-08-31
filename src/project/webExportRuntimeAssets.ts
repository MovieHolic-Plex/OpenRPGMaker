import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import { hasLifeLedgerData } from "@/player/lifeLedger";
import { PLAYER_RUNTIME_ASSET_PATHS } from "@/project/playerDeploymentManifest";
import type { Project } from "@/project/types";

// 등록되지 않은 런타임 에셋은 **항상** 실린다 — 기본값이 안전한 쪽이다.
// 덜어내지 않은 큰 것들의 이유(다시 지우려 들지 않도록):
// - generated/battle-reference-forest.png (2.20MB) 는 battleFieldDom.ts 가 배틀백을 지정하지 않은
//   전투의 **기본 배경 폴백**으로 쓴다. 전투 가능한 게임이면 필요하므로 조건부로 돌릴 수 없다.
//   (1672×941 사진성 이미지를 PNG 로 담아 픽셀당 1.47B — 포맷을 고치는 게 맞는 해결이다.)
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
];

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
