// 버들항 겉모습·숲·물·집 벌·릴리프 지형 아트 JSON 의 지연 출처(?url).
// 브라우저 빌드(vite.config.ts · vite.player.config.ts)에서 scripts/lib/bundledJsonLazy.mjs 가 끼운다.
import type { BundledLookJsonData, BundledLookJsonKey, BundledLookJsonReader } from "./bundledLookJsonSources";
import beodeulStandsUrl from "./beodeulStands.json?url";
import beodeulWaterUrl from "./beodeulWater.json?url";
import beodeulHouseSetsUrl from "./beodeulHouseSets.json?url";
import beodeulLooksUrl from "./beodeulLooks.json?url";
import reliefRampArtUrl from "@/project/relief/rampArt.json?url";
import reliefSheerArtUrl from "@/project/relief/sheerArt.json?url";

const URLS: Record<BundledLookJsonKey, string> = {
  beodeulStands: beodeulStandsUrl,
  beodeulWater: beodeulWaterUrl,
  beodeulHouseSets: beodeulHouseSetsUrl,
  beodeulLooks: beodeulLooksUrl,
  reliefRampArt: reliefRampArtUrl,
  reliefSheerArt: reliefSheerArtUrl,
};

export type { BundledLookJsonData, BundledLookJsonKey, BundledLookJsonReader };
export const BUNDLED_LOOK_JSON_KEYS = Object.keys(URLS) as BundledLookJsonKey[];
export const BUNDLED_LOOK_JSON_LAZY = true;

const warned = new Set<string>();

export function bundledLookJsonSync<K extends BundledLookJsonKey>(key: K): BundledLookJsonData[K] {
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[bundled-look-json] ${key} 를 미리 읽지 않아 동기로 읽습니다 — preloadBundledLookJson 을 앞에서 await 하세요.`);
  }
  const xhr = new XMLHttpRequest();
  xhr.open("GET", URLS[key], false);
  xhr.send();
  if (xhr.status !== 200 && xhr.status !== 0) throw new Error(`번들 겉모습 자료 ${key} 를 읽지 못했습니다 (HTTP ${xhr.status})`);
  return JSON.parse(xhr.responseText) as BundledLookJsonData[K];
}

let reader: BundledLookJsonReader | null = null;

export function setBundledLookJsonReader(next: BundledLookJsonReader | null): void {
  reader = next;
}

export async function loadBundledLookJsonEntry<K extends BundledLookJsonKey>(
  key: K,
  onBytes?: (bytes: number) => void,
): Promise<BundledLookJsonData[K]> {
  if (reader) return JSON.parse(await reader(URLS[key], onBytes ?? (() => undefined))) as BundledLookJsonData[K];
  const response = await fetch(URLS[key]);
  if (!response.ok) throw new Error(`번들 겉모습 자료 ${key} 를 읽지 못했습니다 (HTTP ${response.status})`);
  return (await response.json()) as BundledLookJsonData[K];
}
