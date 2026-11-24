// 번들 타일셋 정의 JSON 의 **node 지연 출처** — vite 가 개발 조건(`development`)으로 풀 때(vitest·vite-node·dev 서버 SSR) package.json 의
// `#bundled-json-sources` 가 정적 출처(bundledJsonSources.ts) 대신 이 파일을 가리킨다.
// 왜(2026-11-24 실측): 정적 출처는 정의 JSON 18개(약 66MB)를 import 하는 즉시 모두 vite 가 JS 로 변환·평가해, 이 모듈을 닿는 시험 파일마다
// 단독 import 가 60초·4GB 였다(defaults.ts). 여기서는 쓰는 키만, 처음 쓸 때 fs 로 읽어 JSON.parse 한다 — 같은 자료를 같은 동기 계약으로 준다.
// 정적 출처가 기본이다(esbuild 묶음·tsx·bun·실행형 HTML·Electron 코어는 조건이 달라 그대로 정적). 이 파일은 소스 트리의 파일을 읽으므로
// 묶음 산출물에서는 쓸 수 없다 — 키·API 는 정적 출처와 같아야 한다(타입이 맞춘다).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { BundledJsonData, BundledJsonKey, BundledJsonReader } from "./bundledJsonSources";

export type { BundledJsonData, BundledJsonKey, BundledJsonReader };

export const BUNDLED_JSON_KEYS = [
  "jpCityTileset",
  "beodeulCityTileset",
  "modernCityTileset",
  "joseonBaramTileset",
  "atlasBiomeInteriorTileset",
  "wizardingWorldTileset",
  "gothicManorTileset",
  "pirateIslesTileset",
  "sfStationTileset",
  "wastelandRuinsTileset",
  "sengokuEdoTileset",
  "modernCampusTileset",
  "steampunkCityTileset",
  "snowNorthTileset",
  "desertEastTileset",
  "prehistoricTileset",
  "skyIslandTileset",
  "beodeulWavePlacesTileset",
] as const satisfies readonly BundledJsonKey[];
/** 정적 출처에 키가 하나라도 더 있으면 여기서 타입 오류가 난다(목록을 같이 고친다). */
const KEYS_COMPLETE: Exclude<BundledJsonKey, (typeof BUNDLED_JSON_KEYS)[number]> extends never ? true : never = true;
void KEYS_COMPLETE;
/** 이 출처가 지연인가 — 읽기가 동기라 호출자 쪽에서는 정적 출처와 같다(false). */
export const BUNDLED_JSON_LAZY = false;

const parsed = new Map<BundledJsonKey, unknown>();

/** 동기로 읽는다. 키마다 한 번만 읽어 같은 객체를 돌려준다. */
export function bundledJsonSync<K extends BundledJsonKey>(key: K): BundledJsonData[K] {
  let value = parsed.get(key);
  if (value === undefined) {
    value = JSON.parse(readFileSync(fileURLToPath(new URL(`../../assets/${key}.json`, import.meta.url)), "utf8"));
    parsed.set(key, value);
  }
  return value as BundledJsonData[K];
}

/** 정적 출처와 같은 모양. 받을 것이 없으므로 무시한다. */
export function setBundledJsonReader(_reader: BundledJsonReader | null): void {}

export async function loadBundledJsonEntry<K extends BundledJsonKey>(key: K, _onBytes?: (bytes: number) => void): Promise<BundledJsonData[K]> {
  return bundledJsonSync(key);
}
