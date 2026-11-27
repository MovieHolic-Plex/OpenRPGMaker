// 번들 타일셋 정의 JSON 의 **Node/SSR 지연 출처** — vite-node·vitest·스크립트·하네스 등 Node 실행에서
// `bundledJsonSources.ts` 대신 끼운다(scripts/lib/bundledJsonLazy.mjs).
//
// 왜: 기본 정적 출처(`bundledJsonSources.ts`)는 18개 대형 타일셋 JSON(총 60MB+)을 모듈 평가 시점에
// 전부 정적 import 한다. vite-node/vitest 가 이를 ESM 모듈로 변환·파싱하면 import 만으로 V8 힙이 급증한다.
// Node 에서는 실제 `bundledJson(key)` 를 부른 시점에 해당 파일 하나만 `readFileSync` + `JSON.parse` 로 읽는다.
// 계약(`BUNDLED_JSON_LAZY = false`, 동기 반환, 캐시는 `bundledJson.ts` 단일)은 정적 출처와 100% 동일하다.
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import type { BundledJsonData, BundledJsonKey, BundledJsonReader } from "./bundledJsonSources";

const ASSET_FILES: Readonly<Record<BundledJsonKey, string>> = {
  jpCityTileset: "../../assets/jpCityTileset.json",
  beodeulCityTileset: "../../assets/beodeulCityTileset.json",
  modernCityTileset: "../../assets/modernCityTileset.json",
  joseonBaramTileset: "../../assets/joseonBaramTileset.json",
  atlasBiomeInteriorTileset: "../../assets/atlasBiomeInteriorTileset.json",
  wizardingWorldTileset: "../../assets/wizardingWorldTileset.json",
  gothicManorTileset: "../../assets/gothicManorTileset.json",
  pirateIslesTileset: "../../assets/pirateIslesTileset.json",
  sfStationTileset: "../../assets/sfStationTileset.json",
  wastelandRuinsTileset: "../../assets/wastelandRuinsTileset.json",
  sengokuEdoTileset: "../../assets/sengokuEdoTileset.json",
  modernCampusTileset: "../../assets/modernCampusTileset.json",
  steampunkCityTileset: "../../assets/steampunkCityTileset.json",
  snowNorthTileset: "../../assets/snowNorthTileset.json",
  desertEastTileset: "../../assets/desertEastTileset.json",
  prehistoricTileset: "../../assets/prehistoricTileset.json",
  skyIslandTileset: "../../assets/skyIslandTileset.json",
  beodeulWavePlacesTileset: "../../assets/beodeulWavePlacesTileset.json",
  monsterKitClimate: "../../assets/monsterKit/monster-climate.json",
  monsterKitCoast: "../../assets/monsterKit/monster-coast.json",
  monsterKitDungeon: "../../assets/monsterKit/monster-dungeon.json",
  monsterKitGyms: "../../assets/monsterKit/monster-gyms.json",
  monsterKitOverworld: "../../assets/monsterKit/monster-overworld.json",
  monsterKitRooms: "../../assets/monsterKit/monster-rooms.json",
  monsterKitWild: "../../assets/monsterKit/monster-wild.json",
  reliefRampArt: "../relief/rampArt.json",
  reliefSheerArt: "../relief/sheerArt.json",
};

export type { BundledJsonData, BundledJsonKey, BundledJsonReader };
export const BUNDLED_JSON_KEYS = Object.keys(ASSET_FILES) as BundledJsonKey[];
/** Node 에서는 동기 fs.readFileSync 로 즉시 읽으므로 비동기 프리로드가 필요 없다. */
export const BUNDLED_JSON_LAZY = false;

export function bundledJsonSync<K extends BundledJsonKey>(key: K): BundledJsonData[K] {
  const filePath = fileURLToPath(new URL(ASSET_FILES[key], import.meta.url));
  return JSON.parse(readFileSync(filePath, "utf8")) as BundledJsonData[K];
}

export function setBundledJsonReader(_reader: BundledJsonReader | null): void {}

export async function loadBundledJsonEntry<K extends BundledJsonKey>(
  key: K,
  _onBytes?: (bytes: number) => void,
): Promise<BundledJsonData[K]> {
  return bundledJsonSync(key);
}
