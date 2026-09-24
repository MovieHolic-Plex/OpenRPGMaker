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
준비/공용 PNG를 직접 보고 W 연장판→전체책상과 의자1칸 이동을 반영했다.
근거 `output/paw-mansion-install/`. 새 실행 이벤트/도시 연결을 뜻하지 않는다.
