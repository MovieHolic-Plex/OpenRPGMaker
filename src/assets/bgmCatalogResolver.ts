// assets/bgmCatalogResolver.ts
// CC0 BGM 카탈로그 리소스 id → 재생 URL.
//
// 생성 파일(bgmCatalogRuntime.ts)과 CDN 조립(bgmCdn.ts) 사이의 얇은 접착층이다.
// 리소스 해석기(generatedAssetResourceResolver)가 이 함수 하나만 알면 되게 분리했다.

import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { bgmTrackUrl } from "@/assets/bgmCdn";

/** 카탈로그 소속이 아니면 null — 해석기가 다음 후보로 넘어간다. */
export function resolveBgmCatalogAssetUrl(resourceId: string): string | null {
  const entry = findBgmRuntimeEntry(resourceId);
  if (entry === undefined) return null;
  return bgmTrackUrl(entry.fileName);
}
