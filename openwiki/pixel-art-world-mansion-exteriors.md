# Pixel Art World 저택 외관3판본

[원본·지붕/발코니 whole·접근·준비 계약](../tiledata/pixel-art-world/MANSION-EXTERIORS.md).
`mansion-exteriors.json`은 raw54, `mansion-exteriors-layout.json`은 합성7/장소3,
`mansion-exteriors-comparison.json`은 원본별 wholeRGBA/alpha 비교다.
prepare-pixel-art-world-mansion-exteriors.mjs → Catalog/Layout JSON.

외부타일셋 카탈로그에서3팩을 선택하며 `externalTilesetImport.ts`가 실제SHA/치수를검증하고
`pixelArtWorldMansionExteriors.ts`에연결한다. 원본408칸보존/B·Y528/P552칸.
전체건물은 원본중앙셀만반복하며 곡면/처마/기단을보존한다. 같은upper에창을찍어벽을지우지않는다.
잘린이웃창을포함하는 raw포르티코는 등록하지않고 sourceRect부분들을 완전난간/기둥으로합성한다.

보행발코니는 미지원이다. 공식3층관계를정적2레이어그림으로대체하고통행을허용하지않는다.
각객체에전체배열/원본근거/정상오류자료, 구조객체에는전체건물관계그림도소유한다.
Publisher는 Catalog54/Layout61/scenes3를구분한다. 준비그림은사용자로컬이며 DB저장은감독자만한다.
