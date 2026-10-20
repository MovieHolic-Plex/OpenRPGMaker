// 월드맵 키트(Python 생성기·3D 아이콘 레이캐스터·테마/아이콘 세트) 위치.
// 정본은 공개 저장소 MovieHolic-Plex/oprn-worldmap-kit 하나다(2026-10-20). 이 저장소에는 구운 시트·TS 어댑터·참고문서 JSON 만 남는다.
// 고정 커밋은 tiledata/worldmap-kit.lock.json, 받기는 `npm run worldmap-kit:sync` → <저장소>/.worldmap-kit (gitignore).
//
// 찾는 순서: OPRN_WORLDMAP_KIT(키트 폴더) → OPRN_REPO_ROOT 또는 이 파일 기준 저장소의 .worldmap-kit/tiledata/worldmap-kit
// import.meta.url 은 호출할 때만 읽는다 — Electron 메인 CJS 번들에서는 import.meta 가 비어 모듈 로드 때 읽으면 앱이 죽는다(2026-10-04).
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const WORLDMAP_KIT_SYNC_HINT = "월드맵 키트가 없다 — 저장소에서 `npm run worldmap-kit:sync` 를 먼저 돌리거나 OPRN_WORLDMAP_KIT 을 키트 폴더(<oprn-worldmap-kit 체크아웃>/tiledata/worldmap-kit)로 지정하라.";

export function worldmapRepoRoot() {
  return process.env.OPRN_REPO_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/** 키트 폴더(= <체크아웃>/tiledata/worldmap-kit). 있는지 확인하지 않는다. */
export function worldmapKitDir() {
  return process.env.OPRN_WORLDMAP_KIT || join(worldmapRepoRoot(), ".worldmap-kit", "tiledata", "worldmap-kit");
}

/** 키트 폴더. 없으면 받는 명령을 담아 던진다. */
export function requireWorldmapKitDir() {
  const dir = worldmapKitDir();
  if (!existsSync(join(dir, "kit", "build_world.py"))) throw new Error(`${WORLDMAP_KIT_SYNC_HINT} (찾은 곳: ${dir})`);
  return dir;
}
