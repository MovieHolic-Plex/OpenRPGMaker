// node 지연 출처(bundledJsonSources.node.ts·bundledAssetJson.node.ts)가 쓰는 파일 읽기 — 저장소 루트 기준 경로로 JSON 을 한 번만 읽어 파싱한다.
// 이 파일 옆에서 먼저 찾고(vitest 의 node 변환·vite-node·dev 서버 SSR), import.meta.url 이 파일 주소가 아닌 변환(vitest 의 happy-dom·jsdom 웹 변환은
// 모듈 주소를 루트 상대 `/src/…` 로 줘서 file:///src/… 가 된다)이면 작업 디렉터리(저장소 루트 — vitest·harness 가 거기서 돈다)에서 찾는다.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const parsed = new Map<string, unknown>();

function locate(repoRelativePath: string): string {
  try {
    const beside = fileURLToPath(new URL(`../../../${repoRelativePath}`, import.meta.url));
    if (existsSync(beside)) return beside;
  } catch {
    // import.meta.url 이 file: 주소가 아니다 — 아래 작업 디렉터리 기준으로 읽는다.
  }
  return resolve(process.cwd(), repoRelativePath);
}

/** 저장소 루트 기준 경로(`src/assets/x.json`)의 JSON 을 읽어 돌려준다. 같은 경로는 같은 객체다. */
export function readBundledJsonFile<T>(repoRelativePath: string): T {
  let value = parsed.get(repoRelativePath);
  if (value === undefined) {
    value = JSON.parse(readFileSync(locate(repoRelativePath), "utf8"));
    parsed.set(repoRelativePath, value);
  }
  return value as T;
}
