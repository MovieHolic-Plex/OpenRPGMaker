// 버들항 겉모습·숲·물·집 벌·릴리프 지형 아트 JSON 의 **Node/SSR 지연 출처** — vitest·vite-node·SSR 등
// Node 실행에서 `bundledLookJsonSources.ts` 대신 끼운다(scripts/lib/bundledJsonLazy.mjs).
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import type { BundledLookJsonData, BundledLookJsonKey, BundledLookJsonReader } from "./bundledLookJsonSources";

const ASSET_FILES: Readonly<Record<BundledLookJsonKey, string>> = {
  beodeulStands: "./beodeulStands.json",
  beodeulWater: "./beodeulWater.json",
  beodeulHouseSets: "./beodeulHouseSets.json",
  beodeulLooks: "./beodeulLooks.json",
  reliefRampArt: "../project/relief/rampArt.json",
  reliefSheerArt: "../project/relief/sheerArt.json",
};

export type { BundledLookJsonData, BundledLookJsonKey, BundledLookJsonReader };
export const BUNDLED_LOOK_JSON_KEYS = Object.keys(ASSET_FILES) as BundledLookJsonKey[];
/** Node 에서는 동기 fs.readFileSync 로 즉시 읽으므로 비동기 프리로드가 필요 없다. */
export const BUNDLED_LOOK_JSON_LAZY = false;

export function bundledLookJsonSync<K extends BundledLookJsonKey>(key: K): BundledLookJsonData[K] {
  const filePath = fileURLToPath(new URL(ASSET_FILES[key], import.meta.url));
  return JSON.parse(readFileSync(filePath, "utf8")) as BundledLookJsonData[K];
}

export function setBundledLookJsonReader(_reader: BundledLookJsonReader | null): void {}

export async function loadBundledLookJsonEntry<K extends BundledLookJsonKey>(
  key: K,
  _onBytes?: (bytes: number) => void,
): Promise<BundledLookJsonData[K]> {
  return bundledLookJsonSync(key);
}
