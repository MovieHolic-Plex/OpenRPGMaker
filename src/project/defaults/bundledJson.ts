// 번들 타일셋 정의 JSON 을 읽는 단 하나의 입구.
//
// 정의 JSON(칸 통행·층·메타·킷)은 새 프로젝트를 만들 때, 첫 부팅 정규화(ensureBundledTilesets)가 옛 사본을 맞출 때,
// 그리고 조립 도구가 번들 판본을 직접 볼 때만 필요하다. 저장된 프로젝트는 자기 사본을 들고 있으므로 열기·그리기에는 쓰지 않는다.
// 그래서 편집기(2026-10-20, 시작 속도 2단계)와 웹 플레이어(2026-10-30)는 이것을 진입 청크에 싣지 않고(bundledJsonSources.lazy.ts)
// 필요한 것만 읽는다. 실행형 HTML 과 node 실행(테스트·스크립트·Electron 메인)은 정적 출처로 동기로 갖는다.
//
// 계약:
//  - `bundledJson(key)` 는 동기다. 읽어 둔 것이 있으면 그것을, 없으면 출처의 동기 읽기를 쓴다(정적 출처는 곧바로, 지연 출처는 동기 XHR).
//  - 동기 읽기는 안전망이다. 많이 쓰는 길(첫 부팅 정규화·새 프로젝트)은 `preloadBundledJson` 을 먼저 await 한다.
//  - 자료 객체는 키마다 하나다. 호출자는 지금처럼 structuredClone 해서 쓴다(제자리 수정 금지).
import {
  BUNDLED_JSON_KEYS,
  BUNDLED_JSON_LAZY,
  bundledJsonSync,
  loadBundledJsonEntry,
  setBundledJsonReader,
  type BundledJsonData,
  type BundledJsonKey,
} from "./bundledJsonSources";

export type { BundledJsonKey };
export type { BundledJsonReader } from "./bundledJsonSources";
export { setBundledJsonReader };

/** 미리 읽기 진행: 끝난 파일 수 / 이번에 받을 파일 수, 받은 바이트(지연 출처만 센다). */
export type BundledJsonProgress = (done: number, total: number, bytes: number) => void;

const cache = new Map<BundledJsonKey, unknown>();
const pending = new Map<BundledJsonKey, Promise<void>>();

export function bundledJson<K extends BundledJsonKey>(key: K): BundledJsonData[K] {
  let value = cache.get(key) as BundledJsonData[K] | undefined;
  if (value === undefined) {
    value = bundledJsonSync(key);
    cache.set(key, value);
  }
  return value;
}

export function bundledJsonLoaded(key: BundledJsonKey): boolean {
  return !BUNDLED_JSON_LAZY || cache.has(key);
}

/**
 * 키들을 비동기로 읽어 둔다. 이미 읽었거나 읽는 중이면 그 결과를 기다린다. 키를 안 주면 전부.
 * progress 는 이번 호출이 새로 받기 시작한 파일의 바이트만 센다(다른 호출이 받는 중인 파일은 끝난 수로만 센다).
 */
export function preloadBundledJson(keys: readonly BundledJsonKey[] = BUNDLED_JSON_KEYS, progress?: BundledJsonProgress): Promise<void> {
  if (!BUNDLED_JSON_LAZY) return Promise.resolve();
  const waits: Promise<void>[] = [];
  let done = 0;
  let bytes = 0;
  const onBytes = progress ? (delta: number): void => { bytes += delta; progress(done, waits.length, bytes); } : undefined;
  for (const key of keys) {
    if (cache.has(key)) continue;
    let wait = pending.get(key);
    if (!wait) {
      wait = loadBundledJsonEntry(key, onBytes).then((value) => {
        if (!cache.has(key)) cache.set(key, value);
      }).finally(() => pending.delete(key));
      pending.set(key, wait);
    }
    waits.push(progress ? wait.then(() => { done += 1; progress(done, waits.length, bytes); }) : wait);
  }
  if (progress && waits.length) progress(0, waits.length, 0);
  return waits.length ? Promise.all(waits).then(() => undefined) : Promise.resolve();
}

/** 번들 칩셋 텍스처 키 → 그 타일셋을 만들거나 맞출 때 필요한 정의 JSON. 여기 없는 칩셋은 정의가 작아 정적으로 실린다. */
const TEXTURE_KEYS: Readonly<Record<string, BundledJsonKey>> = {
  tex_jp_city: "jpCityTileset",
  tex_beodeul_city: "beodeulCityTileset",
  tex_modern_city: "modernCityTileset",
  tex_joseon_baram: "joseonBaramTileset",
  tex_atlas_biome_interior: "atlasBiomeInteriorTileset",
  tex_wizarding_world: "wizardingWorldTileset",
  tex_gothic_manor: "gothicManorTileset",
  tex_pirate_isles: "pirateIslesTileset",
  tex_sf_station: "sfStationTileset",
  tex_wasteland_ruins: "wastelandRuinsTileset",
  tex_sengoku_edo: "sengokuEdoTileset",
  tex_modern_campus: "modernCampusTileset",
  tex_steampunk_city: "steampunkCityTileset",
  tex_snow_north: "snowNorthTileset",
  tex_desert_east: "desertEastTileset",
  tex_prehistoric: "prehistoricTileset",
  tex_sky_island: "skyIslandTileset",
  tex_beodeul_wave_places: "beodeulWavePlacesTileset",
};

/** 번들 텍스처 키에 딸린 정의 JSON 키(없으면 undefined). */
export function bundledJsonKeyForTexture(textureKey: string): BundledJsonKey | undefined {
  return TEXTURE_KEYS[textureKey];
}

/**
 * 프로젝트의 맵이 실제로 쓰는 번들 타일셋의 정의 JSON 을 읽어 둔다(타일셋 id → 그 사본의 번들 텍스처 키).
 * 조립 도구·팔레트가 번들 판본을 동기로 물을 때 동기 읽기로 떨어지지 않게 한다.
 */
export function preloadBundledJsonForProject(project: {
  readonly maps?: Readonly<Record<string, { readonly tilesetId?: string }>>;
  readonly tilesets?: Readonly<Record<string, { readonly image?: { readonly type: string; readonly id?: string } }>>;
}): Promise<void> {
  const keys = new Set<BundledJsonKey>();
  for (const map of Object.values(project.maps ?? {})) {
    const image = map.tilesetId ? project.tilesets?.[map.tilesetId]?.image : undefined;
    const key = image?.type === "bundled" && image.id ? TEXTURE_KEYS[image.id] : undefined;
    if (key) keys.add(key);
  }
  return preloadBundledJson([...keys]);
}
