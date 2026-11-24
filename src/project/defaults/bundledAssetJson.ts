// 큰 번들 정의·참고문서 JSON(합쳐 약 10MB)의 **정적 출처** — 읽는 입구는 package.json 의 `#bundled-asset-json` 다.
//
// 왜(2026-11-24 실측): 이 JSON 들을 소비 모듈이 최상위에서 정적 import 하면, 소비 모듈을 닿는 시험 파일마다(defaults.ts 배럴 → 시험 1,000여 개)
// vitest 가 파일 하나에 수 MB 를 JS 로 변환·평가했다. `development` 조건(vitest·vite-node·dev 서버 SSR)에서는 `#bundled-asset-json` 이
// bundledAssetJson.node.ts 로 풀려 쓰는 것만 fs 로 읽는다. 그 밖(브라우저 빌드·esbuild·tsx·Electron·실행형 HTML)은 이 파일이라 예전과 같이
// 번들에 품는다 — 키마다 따로 내보내므로 안 쓰는 키는 번들러가 걷어낸다. 이 파일의 내보내기를 바꾸면 node 출처도 같이 고친다(타입이 맞춘다).
// 호출자는 지금처럼 structuredClone 해서 쓴다(제자리 수정 금지) — 키마다 객체 하나다.
import rampArt from "../relief/rampArt.json" with { type: "json" };
import jpCityReferences from "@/assets/jpCityReferences.json" with { type: "json" };
import beodeulGroundReferences from "@/assets/beodeulGroundReferences.json" with { type: "json" };
import beodeulFacilitiesReferences from "@/assets/beodeulFacilitiesReferences.json" with { type: "json" };
import emeraldMonsterReferences from "@/assets/emeraldMonsterReferences.json" with { type: "json" };

/** 바이옴 경사로 도트(src/project/relief/rampArt.json). */
export function rampArtJson(): typeof rampArt {
  return rampArt;
}
/** 일본 도시 칩셋 참고문서(src/assets/jpCityReferences.json). */
export function jpCityReferencesJson(): typeof jpCityReferences {
  return jpCityReferences;
}
/** 버들항 바닥 칩셋 참고문서(src/assets/beodeulGroundReferences.json). */
export function beodeulGroundReferencesJson(): typeof beodeulGroundReferences {
  return beodeulGroundReferences;
}
/** 버들항 시설 칩셋 참고문서(src/assets/beodeulFacilitiesReferences.json). */
export function beodeulFacilitiesReferencesJson(): typeof beodeulFacilitiesReferences {
  return beodeulFacilitiesReferences;
}
/** 에메랄드풍 몬스터 시트 참고문서(src/assets/emeraldMonsterReferences.json, 텍스처 키별). */
export function emeraldMonsterReferencesJson(): typeof emeraldMonsterReferences {
  return emeraldMonsterReferences;
}
