// assets/seCatalogResolver.ts
// CC0 효과음 카탈로그 리소스 id → 재생 URL.
//
// 생성 파일(seCatalogRuntime.ts)과 리소스 해석기 사이의 얇은 접착층이다.
// bgmCatalogResolver 와 같은 역할이지만 CDN 조립이 없다 — SE 파일은 레포에 있다
// (public/assets/se/, 21.7MB). 그래서 항상 동일 출처 절대 경로가 나온다.

import { findSeRuntimePath } from "@/assets/seCatalogRuntime";

/** 카탈로그 소속이 아니면 null — 해석기가 다음 후보로 넘어간다. */
export function resolveSeCatalogAssetUrl(resourceId: string): string | null {
  const path = findSeRuntimePath(resourceId);
  return path === undefined ? null : `/${path}`;
}
