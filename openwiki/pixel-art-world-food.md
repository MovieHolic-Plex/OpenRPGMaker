# Pixel Art World 음식 소품 다운로드·상판 합성

카탈로그29의 직접 PNG10개만 다룬다. `food.json` → `prepare-pixel-art-world-food.mjs` → `pixelArtWorldFoodCatalog.json`에 출처/SHA/전체 객체의 칸·픽셀 좌표/alphaBounds/기준점/제외가 있다. 원본은9개128×128과 구판F-Party02 128×96이다. 4열156칸을153개의 완전한 그림 묶음으로 나눈다. 구판 열린 피자 상자는64×64라4칸을 한 객체로 쓴다. 여러 소품이 한 칸 안에 있으면 고정 묶음으로 유지한다. 음식·식기·포장·식후는 정적 상태이며 방향/애니메이션으로 추정하지 않는다.

`pixelArtWorldFood.ts`는 원본4열 타일셋과 식탁 합성12열 타일셋/고정 그룹/전체5×5조립 배열을 만든다. `pixelArtWorldFoodImport.ts`는 사용자 파일 둘을 SHA+decode+alphaBounds로 검사하고, 별도 ST-Icecream-I01의 완전한3×2식탁과 음식픽셀을 합성한다. 원본 식탁(0,512)96×64를3×3캔버스(0,32)에 먼저 그린 뒤 음식의 비투명 밑변 중심을(48,55)에 놓는다. 원본을 확대/축소하지 않는다. 원본파일을 앱/서버가 대신 다운로드하지 않는다.

음식 원본은upper/passable이고 받침이 필요하다. 음식만 기존상위식탁에 찍으면 식탁이 지워진다. 완전합성3×3그룹은upper이며 위 돌출행은통과, 아래식탁2행은차단이다. 바닥은하위0번으로보존하고 남쪽한칸접근을 남긴다. 매달린고기/소시지/장갑3개의 고정점조립은미검토이므로 식탁합성에서제외한다. 원본153그룹과 검토된150식탁그룹을 구분한다. 원본/합성 타일번호는서로호환되지않는다.

`panels/pixelArtWorldFoodCatalog.ts`는 기존 외부타일셋자료집에10카드를 붙인다. 음식파일과받침파일을 함께선택한다. 준비는pure이며확정등록은lineage/저장대상/abort검사후하나의snapshot+store.update로두타일셋/두에셋을넣는다. 기존다이얼로그의busy/controls를공유한다. prepare결과의kits는객체조립표본이며자동게임맵이나먹기이벤트가아니다.

브라우저 개인출력 생성: `node scripts/content/render-pixel-art-world-food.mjs /absolute/downloads http://127.0.0.1:9877`. 승인된워크트리런처를먼저실행한다. 이명령은실제prepare와카드표시만확인하고store/import/save를호출하지않는다. `output/paw-food/browser`의preparedJSON·PNG·install-plan은개인용이며Git/public에싣지않는다. 반환dataUrl은브라우저디코딩후RGBA PNG이므로파일바이트SHA가원본SHA와같다고검증하면안된다. sourceSha256/supportSha256는입력파일검사를통과한원본해시다.

20타일셋·20용도·323MD·313이미지, 원본153그룹+식탁150그룹이준비된다. 150개의5×5는완성객체의조립예제이며150개의방/장소가아니다. source준비/조립검토/공용게시/정본설치를별도단계로보고한다. root전용publisher및정본저장은이모듈의책임이아니다. 자세한전판사전과라이선스는`tiledata/pixel-art-world/FOOD.md`.
