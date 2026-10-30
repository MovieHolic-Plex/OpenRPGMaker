// 번들 타일셋 정의 JSON(통행·층·칸 메타·킷, 합쳐 약 43MB)의 **기본 출처 = 정적 import**.
//
// 편집기·시작 화면(vite.config.ts)과 웹 플레이어(vite.player.config.ts)의 브라우저 빌드는 이 모듈을
// `bundledJsonSources.lazy.ts`(파일 URL → 처음 쓸 때 fetch)로 바꿔 끼운다(scripts/lib/bundledJsonLazy.mjs).
// 실행형 HTML(vite.standalone.config.ts, file://)과 node 실행(테스트·tsx 스크립트·헤드리스·vite-node·Electron 메인)은
// 이 파일 그대로라 예전과 똑같이 동기로 갖는다.
// 왜(2026-10-20 실측, 편집기 웜 부팅): 이 JSON 이 편집기 진입 청크 63MB 의 대부분이었고, 열린 프로젝트는 보통 그중 몇 개만 쓴다.
// 읽는 곳은 bundledJson.ts 하나다 — 다른 곳에서 이 모듈을 직접 가져오지 말 것(바꿔 끼우기가 빗나간다).
import jpCityTileset from "@/assets/jpCityTileset.json";
import beodeulCityTileset from "@/assets/beodeulCityTileset.json";
import modernCityTileset from "@/assets/modernCityTileset.json";
import joseonBaramTileset from "@/assets/joseonBaramTileset.json";
import atlasBiomeInteriorTileset from "@/assets/atlasBiomeInteriorTileset.json";
import wizardingWorldTileset from "@/assets/wizardingWorldTileset.json";
import gothicManorTileset from "@/assets/gothicManorTileset.json";
import pirateIslesTileset from "@/assets/pirateIslesTileset.json";
import sfStationTileset from "@/assets/sfStationTileset.json";
import wastelandRuinsTileset from "@/assets/wastelandRuinsTileset.json";
import sengokuEdoTileset from "@/assets/sengokuEdoTileset.json";
import modernCampusTileset from "@/assets/modernCampusTileset.json";
import steampunkCityTileset from "@/assets/steampunkCityTileset.json";
import snowNorthTileset from "@/assets/snowNorthTileset.json";
import desertEastTileset from "@/assets/desertEastTileset.json";
import prehistoricTileset from "@/assets/prehistoricTileset.json";
import skyIslandTileset from "@/assets/skyIslandTileset.json";
import beodeulWavePlacesTileset from "@/assets/beodeulWavePlacesTileset.json";

const ALL = {
  jpCityTileset,
  beodeulCityTileset,
  modernCityTileset,
  joseonBaramTileset,
  atlasBiomeInteriorTileset,
  wizardingWorldTileset,
  gothicManorTileset,
  pirateIslesTileset,
  sfStationTileset,
  wastelandRuinsTileset,
  sengokuEdoTileset,
  modernCampusTileset,
  steampunkCityTileset,
  snowNorthTileset,
  desertEastTileset,
  prehistoricTileset,
  skyIslandTileset,
  beodeulWavePlacesTileset,
};

export type BundledJsonData = typeof ALL;
export type BundledJsonKey = keyof BundledJsonData;
export const BUNDLED_JSON_KEYS = Object.keys(ALL) as BundledJsonKey[];
/** 이 출처가 지연인가(편집기·웹 플레이어 브라우저 빌드만 true). */
export const BUNDLED_JSON_LAZY = false;

/** 동기로 바로 준다. */
export function bundledJsonSync<K extends BundledJsonKey>(key: K): BundledJsonData[K] {
  return ALL[key];
}

/**
 * 지연 출처가 파일을 받는 방법을 바꾼다(웹 플레이어: 멈춤 감시 fetch). 받은 바이트(증감)를 onBytes 로 알리고 본문 글자를 돌려준다.
 * 정적 출처는 받을 것이 없으므로 무시한다.
 */
export type BundledJsonReader = (url: string, onBytes: (bytes: number) => void) => Promise<string>;
export function setBundledJsonReader(_reader: BundledJsonReader | null): void {}

export async function loadBundledJsonEntry<K extends BundledJsonKey>(key: K, _onBytes?: (bytes: number) => void): Promise<BundledJsonData[K]> {
  return ALL[key];
}
