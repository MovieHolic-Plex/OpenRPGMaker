# Pixel Art World 개별 소품 조립 보충

범위/정확한좌표/남은보류: `tiledata/pixel-art-world/LOOSE-SUPPLEMENTS.md`.

기존 loose539객체/106prepared를바꾸지않는독립5atlas. `loose-supplements.json` → `prepare-pixel-art-world-loose-supplements.mjs` → `pixelArtWorldLooseSupplementsCatalog.json`. `pixelArtWorldLooseSupplements.ts`는객체10(주상태9+기존벤치1)/장소5의전체배열과타일셋을만든다. 일반importer/appender도기존loose와별도다. 공유publisher/정본writer는감독자소유.

소스파트픽셀좌표와출력32px칸을섞지않는다. front/back는원본을개인atlas에굽는순서이며맵상위레이어를겹쳐쓰는기능이아니다. replace파트는이전상태/그림자를지운다. 객체하위-1/상위전체,장소는두레이어전체를kit가소유한다. L화단공백은-1로유지한다.

source/support먼저읽기·원본전체·파트정상반례·배열정상오류·장소문서를kit별로소유. 그림문/FPS/애니메이션을실제기능으로추정하지않는다. 열린신사/새장은정적전체차단,촛불은frame0만. 흙L화단은심기전표본이다. 모든PNG/dataURL은사용자가제공한원본에서privateprepare/import로만생성하며Git/public픽셀없음.
