// 번들 타일셋 정의 JSON 의 **지연 출처** — 편집기·시작 화면(vite.config.ts)과 웹 플레이어(vite.player.config.ts)의 브라우저 빌드·dev 서버가
// `bundledJsonSources.ts` 대신 끼운다(scripts/lib/bundledJsonLazy.mjs). 실행형 HTML·node 실행은 정적 출처 그대로다.
// 파일은 JS 모듈이 아니라 원본 JSON 자산으로 실리고(`?url`), 처음 필요할 때 fetch + JSON.parse 한다 — 진입 청크에 싣지 않는다.
// 부팅은 필요한 것만 미리 읽는다(store.normalizeCurrentProject 의 첫 부팅 정규화, 편집기 settled 뒤 열린 맵이 쓰는 타일셋).
// 미리 읽지 않은 것을 동기로 물으면 같은 파일을 동기 XHR 로 읽는다(드문 길 — 콘솔에 한 번 경고). 계약은 bundledJson.ts 머리말.
import type { BundledJsonData, BundledJsonKey, BundledJsonReader } from "./bundledJsonSources";
import jpCityTilesetUrl from "@/assets/jpCityTileset.json?url";
import beodeulCityTilesetUrl from "@/assets/beodeulCityTileset.json?url";
import modernCityTilesetUrl from "@/assets/modernCityTileset.json?url";
import joseonBaramTilesetUrl from "@/assets/joseonBaramTileset.json?url";
import atlasBiomeInteriorTilesetUrl from "@/assets/atlasBiomeInteriorTileset.json?url";
import wizardingWorldTilesetUrl from "@/assets/wizardingWorldTileset.json?url";
import gothicManorTilesetUrl from "@/assets/gothicManorTileset.json?url";
import pirateIslesTilesetUrl from "@/assets/pirateIslesTileset.json?url";
import sfStationTilesetUrl from "@/assets/sfStationTileset.json?url";
import wastelandRuinsTilesetUrl from "@/assets/wastelandRuinsTileset.json?url";
import sengokuEdoTilesetUrl from "@/assets/sengokuEdoTileset.json?url";
import modernCampusTilesetUrl from "@/assets/modernCampusTileset.json?url";
import steampunkCityTilesetUrl from "@/assets/steampunkCityTileset.json?url";
import snowNorthTilesetUrl from "@/assets/snowNorthTileset.json?url";
import desertEastTilesetUrl from "@/assets/desertEastTileset.json?url";
import prehistoricTilesetUrl from "@/assets/prehistoricTileset.json?url";
import skyIslandTilesetUrl from "@/assets/skyIslandTileset.json?url";

const URLS: Record<BundledJsonKey, string> = {
  jpCityTileset: jpCityTilesetUrl,
  beodeulCityTileset: beodeulCityTilesetUrl,
  modernCityTileset: modernCityTilesetUrl,
  joseonBaramTileset: joseonBaramTilesetUrl,
  atlasBiomeInteriorTileset: atlasBiomeInteriorTilesetUrl,
  wizardingWorldTileset: wizardingWorldTilesetUrl,
  gothicManorTileset: gothicManorTilesetUrl,
  pirateIslesTileset: pirateIslesTilesetUrl,
  sfStationTileset: sfStationTilesetUrl,
  wastelandRuinsTileset: wastelandRuinsTilesetUrl,
  sengokuEdoTileset: sengokuEdoTilesetUrl,
  modernCampusTileset: modernCampusTilesetUrl,
  steampunkCityTileset: steampunkCityTilesetUrl,
  snowNorthTileset: snowNorthTilesetUrl,
  desertEastTileset: desertEastTilesetUrl,
  prehistoricTileset: prehistoricTilesetUrl,
  skyIslandTileset: skyIslandTilesetUrl,
};

export type { BundledJsonData, BundledJsonKey, BundledJsonReader };
export const BUNDLED_JSON_KEYS = Object.keys(URLS) as BundledJsonKey[];
export const BUNDLED_JSON_LAZY = true;

const warned = new Set<string>();

/** 미리 읽지 않은 자료를 동기로 물었을 때만 온다 — 같은 자산을 동기 XHR 로 읽는다. */
export function bundledJsonSync<K extends BundledJsonKey>(key: K): BundledJsonData[K] {
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[bundled-json] ${key} 를 미리 읽지 않아 동기로 읽습니다 — 이 길이 잦으면 preloadBundledJson 을 앞에서 await 하세요.`);
  }
  const xhr = new XMLHttpRequest();
  xhr.open("GET", URLS[key], false);
  xhr.send();
  if (xhr.status !== 200 && xhr.status !== 0) throw new Error(`번들 자료 ${key} 를 읽지 못했습니다 (HTTP ${xhr.status})`);
  return JSON.parse(xhr.responseText) as BundledJsonData[K];
}

let reader: BundledJsonReader | null = null;

/** 받는 방법을 바꾼다 — 웹 플레이어는 멈춤 감시 fetch(scenePreload.fetchBlobWithRetry)를 넣는다. null 이면 기본 fetch. */
export function setBundledJsonReader(next: BundledJsonReader | null): void {
  reader = next;
}

export async function loadBundledJsonEntry<K extends BundledJsonKey>(key: K, onBytes?: (bytes: number) => void): Promise<BundledJsonData[K]> {
  if (reader) return JSON.parse(await reader(URLS[key], onBytes ?? (() => undefined))) as BundledJsonData[K];
  const response = await fetch(URLS[key]);
  if (!response.ok) throw new Error(`번들 자료 ${key} 를 읽지 못했습니다 (HTTP ${response.status})`);
  return (await response.json()) as BundledJsonData[K];
}
