// 큰 번들 정의·참고문서 JSON 의 **node 지연 출처** — `development` 조건(vitest·vite-node·dev 서버 SSR)에서 package.json 의
// `#bundled-asset-json` 이 정적 출처(bundledAssetJson.ts) 대신 이 파일을 가리킨다. 쓰는 키만, 처음 쓸 때 fs 로 읽어 JSON.parse 한다 —
// 같은 자료를 같은 동기 계약(키마다 객체 하나)으로 준다. 소스 트리의 파일을 읽으므로 묶음 산출물에서는 쓸 수 없다(그쪽은 정적 출처).
import { readBundledJsonFile } from "./bundledJsonFile.node";
import type * as StaticSource from "./bundledAssetJson";

export const rampArtJson: typeof StaticSource.rampArtJson = () => readBundledJsonFile("src/project/relief/rampArt.json");
export const jpCityReferencesJson: typeof StaticSource.jpCityReferencesJson = () => readBundledJsonFile("src/assets/jpCityReferences.json");
export const beodeulGroundReferencesJson: typeof StaticSource.beodeulGroundReferencesJson = () => readBundledJsonFile("src/assets/beodeulGroundReferences.json");
export const beodeulFacilitiesReferencesJson: typeof StaticSource.beodeulFacilitiesReferencesJson = () => readBundledJsonFile("src/assets/beodeulFacilitiesReferences.json");
export const emeraldMonsterReferencesJson: typeof StaticSource.emeraldMonsterReferencesJson = () => readBundledJsonFile("src/assets/emeraldMonsterReferences.json");

/** 정적 출처에 내보내기가 하나라도 더 있거나 이쪽에 모자라면 여기서 타입 오류가 난다(목록을 같이 고친다). */
void ({
  rampArtJson,
  jpCityReferencesJson,
  beodeulGroundReferencesJson,
  beodeulFacilitiesReferencesJson,
  emeraldMonsterReferencesJson,
} satisfies typeof StaticSource);
