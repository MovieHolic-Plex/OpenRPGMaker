// scripts/lib/viteCacheDir.mjs
// dev 서버의 vite 의존성 최적화 캐시를 체크아웃마다 떼어 놓는다.
//
// 왜(2026-09-24 실측): `npm run wt` 는 워크트리의 node_modules 를 메인 체크아웃으로 통째 심링크한다
// (당시 워크트리 92개 중 46개). 그러면 vite 기본 캐시 `node_modules/.vite` 도 메인 것 하나를 같이 쓴다.
// vite 는 캐시 해시에 root 를 넣으므로(getConfigHash) root 가 다른 dev 서버는 서로의 캐시를 «낡음»
// 으로 보고 재최적화해 덮어쓴다 — 매 부팅이 느려지고, 동시에 떠 있으면 상대 페이지가 강제 리로드되거나
// "Failed to scan for dependencies" 로 서버가 죽는다(vite.config.ts cacheDir 주석의 실측 3회).
//
// 판정은 «git 워크트리인가» 가 아니라 «node_modules 가 이 체크아웃 밖을 가리키는가» 다 —
// 패키지별로 링크한 워크트리는 .vite 가 이미 제 것이고, git 밖 사본(/tmp 기준선)도 같은 구멍을 가진다.
import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";

/**
 * 공유 node_modules 를 쓰는 체크아웃이면 `{ VITE_CACHE_DIR: <root>/.vite-cache/dev }`, 아니면 `{}`.
 * 이미 VITE_CACHE_DIR 이 있으면(QA 스크립트의 전용 캐시) 건드리지 않는다.
 */
export function devViteCacheEnv(root, env = process.env) {
  if (env.VITE_CACHE_DIR) return {};
  const modules = join(root, "node_modules");
  if (!existsSync(modules)) return {};
  const shared = realpathSync(modules) !== join(realpathSync(root), "node_modules");
  return shared ? { VITE_CACHE_DIR: join(root, ".vite-cache", "dev") } : {};
}
