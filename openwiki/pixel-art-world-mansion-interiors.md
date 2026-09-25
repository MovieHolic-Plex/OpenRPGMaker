# Pixel Art World 저택 내부5판본

[판본·whole경계·상판·장소·준비 계약](../tiledata/pixel-art-world/MANSION-INTERIORS.md).
원본 metadata는 mansion-interiors.json, 장면/합성은 mansion-interiors-layout.json,
원본 간 per-object RGBA/alpha 비교는 mansion-interiors-comparison.json이다.
prepare-pixel-art-world-mansion-interiors.mjs가 Catalog/Layout JSON을 만든다.

`externalTilesetCatalog.ts`에5팩을 추가하며 `externalTilesetImport.ts`가 실제 원본SHA/치수 확인 후
`pixelArtWorldMansionInteriors.ts`를 사용한다. 원본440칸 유지, W/R 합성만 뒤에16칸씩 추가한다.
다른 기존 팩은 기존 appender 동작을 유지한다. 픽셀은 사용자 원본에서만 생성하고 Git에 넣지 않는다.

객체130개는 전체배열 MD/원본비교 MD/정상오류 그림을 각 structureKit에 소유한다.
소파 앞뒤·R 유리진열장은 모양 비교도해를 관련 객체에 추가해 타일문서만 경유하는 상태를 피한다.
공용 publisher는 Catalog raw128과 Layout final130/scenes5를 구분해야 한다.
prepare/install은 DB를 쓰지 않으며 canonical/shared 저장은 감독자만 실행한다.

## 공용 게시·정본 재로드 (2026-09-25)

감독자가 실제 importer로5원본/130객체/5장소를 다시 준비했다. 원본440칸을 보존하며
일본식 실내와 같은 Catalog+Layout 대응으로 native publisher가 owned 문서와 파생 배열을 복사한다.
`publish-pixel-art-world-local-library.mjs`의 nativeLayouts에는 두 계열을 함께 등록하고,
원본 칸 수는 pack 치수에서 계산한다. 지역 확장에도5장소의 정확한 배열/출입구를 포함한다.
정본revision50 native5→revision51 공용31타일셋/74자산의 메타/바이트 재로드 일치,
기존12맵 보존. 실제canMove49접근점 양방향, AI570MD/578페이지/448그림 전달 확인.
당시 W 가구를3×2형으로 바꾸고 의자를1칸 당겼다. 후속 원본 대조에서는 연장판/책상 명칭이 단정적이었음을 확인해 상판·전면 패널 가구로 정정했다.
근거 `output/paw-mansion-install/`. 새 실행 이벤트/도시 연결을 뜻하지 않는다.

2026-09-25 범위380 고정 후 정정: `writing-desk` ID의3×2와 `dining-table`의3×3은
서로 다른 원본이다.3×2를 러그로 판단한 후속 지적도 확인되지 않아 픽셀/배열은 유지한다.
관찰 가능한 목재 상판·전면 패널로 이름을 고치고 실제나란한그림 `table-panel-proof`를
타일과 두 객체 소유 문서에 각각 제공한다. 정확한 제작자 용도 명칭은 미확인이다.
정본 revision62에 native 문서를, revision63에 공용5타일 문서를 저장·재로드했다.
5판본의 기존 타일 계약/그림/객체 배열 및12맵을 유지한다. 중간 재생성에서 발견한
native priority 차이는 기존값으로 복원한 뒤 재로드했다. 실제 AI 도구가588MD/596페이지/
481그림을 전달했으며 private근거는 `output/paw-380-corrections/`다.
