// 버들항 겉모습·숲·물·집 벌·릴리프 지형 아트 JSON(합쳐 약 6.8MB)의 정적 출처.
// 브라우저 빌드(vite.config.ts · vite.player.config.ts)는 scripts/lib/bundledJsonLazy.mjs 가
// `bundledLookJsonSources.lazy.ts`(?url 지연 fetch)로 바꿔 끼운다.
// 72MB 타일셋 정의 묶음(`bundledJsonSources.ts`)과 분리해 releaseDependencyCollector(esbuild)가
// 타일셋 정의 72MB 를 끌어오지 않게 한다.
import beodeulStands from "./beodeulStands.json" with { type: "json" };
import beodeulWater from "./beodeulWater.json" with { type: "json" };
import beodeulHouseSets from "./beodeulHouseSets.json" with { type: "json" };
import beodeulLooks from "./beodeulLooks.json" with { type: "json" };
import reliefRampArt from "@/project/relief/rampArt.json" with { type: "json" };
import reliefSheerArt from "@/project/relief/sheerArt.json" with { type: "json" };

const ALL = {
  beodeulStands,
  beodeulWater,
  beodeulHouseSets,
  beodeulLooks,
  reliefRampArt,
  reliefSheerArt,
};

export type BundledLookJsonData = typeof ALL;
export type BundledLookJsonKey = keyof BundledLookJsonData;
export const BUNDLED_LOOK_JSON_KEYS = Object.keys(ALL) as BundledLookJsonKey[];
export const BUNDLED_LOOK_JSON_LAZY = false;

export function bundledLookJsonSync<K extends BundledLookJsonKey>(key: K): BundledLookJsonData[K] {
  return ALL[key];
}

export type BundledLookJsonReader = (url: string, onBytes: (bytes: number) => void) => Promise<string>;
export function setBundledLookJsonReader(_reader: BundledLookJsonReader | null): void {}

export async function loadBundledLookJsonEntry<K extends BundledLookJsonKey>(
  key: K,
  _onBytes?: (bytes: number) => void,
): Promise<BundledLookJsonData[K]> {
  return ALL[key];
}
