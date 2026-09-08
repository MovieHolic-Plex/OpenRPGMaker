import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

/** public/ 와 dist/ 아래에서 카탈로그가 놓이는 상대 경로. 시드와 런타임 status 가 함께 쓴다. */
export const CATALOG_RELATIVE_DIR = "assets/cc0/audio/catalog";

/**
 * 설치된 카탈로그 파일명(정렬).
 *
 * 규칙이 빌드타임 시드와 런타임 status 사이에서 갈라지면 새로고침만으로 재생 가능 여부가
 * 뒤집히는 버그가 된다. 그래서 두 곳 모두 이 함수 하나만 부른다.
 */
export function listInstalledCatalogFiles(directory: string): string[] {
  let entries: string[];
  try { entries = readdirSync(directory); }
  catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    // 팩 미설치는 오류가 아니다 — 아직 아무것도 없는 상태일 뿐이다.
    if (code === "ENOENT" || code === "ENOTDIR") return [];
    throw error;
  }
  return entries
    .filter(file => /\.(?:mp3|wav)$/i.test(file) && statSync(resolve(directory, file)).size > 0)
    .sort();
}
