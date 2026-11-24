// 번들 타일셋 차이 본문의 키 이름 하나만 담는 가벼운 모듈.
//
// 왜(2026-11-24 qa1124 실측): Electron 메인(electron/local-store/store.ts)이 저장소 형식 표지를 찾으려고 이 문자열 하나를
// bundledTilesetDiff.ts 에서 가져오자, 그 모듈이 끌고 오는 번들 타일셋 정의 JSON 112MB 가 메인 본체(app.cjs)에 실려
// 121.5MB 가 됐고, 앱을 켤 때마다 그 본체를 읽는 데 3초 넘게 걸렸다. 이 파일은 아무것도 import 하지 않는다.
export const BUNDLED_TILESET_DIFF = "bundledTilesetDiff";
