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
