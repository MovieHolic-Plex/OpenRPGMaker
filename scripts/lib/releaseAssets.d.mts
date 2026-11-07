// scripts/lib/releaseAssets.d.mts
// scripts/lib/releaseAssets.mjs 의 타입 선언.

/** 릴리스에 있어야 하는 데스크톱 자산 이름 6개(버전 없는 고정 이름 3 + 버전 이름 3). */
export function requiredDesktopAssets(version: string): readonly string[];

export type ReleaseAssetLike = {
  readonly name?: string;
  readonly size?: number;
  readonly state?: string;
};

export type DesktopAssetsCheck = {
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly empty: readonly string[];
};

/** 없는 이름과 크기 0 인 자산을 가려낸다. */
export function checkDesktopAssets(version: string, assets: ReadonlyArray<ReleaseAssetLike>): DesktopAssetsCheck;

/** vX.Y.Z 태그 중 가장 높은 것(없으면 null). */
export function highestReleaseTag(tags: Iterable<string>): string | null;
