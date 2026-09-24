# Pixel Art World 음식 소품 다운로드·상판 합성

카탈로그29의 직접 PNG10개만 다룬다. `food.json` → `prepare-pixel-art-world-food.mjs` → `pixelArtWorldFoodCatalog.json`에 출처/SHA/전체 객체의 칸·픽셀 좌표/alphaBounds/기준점/제외가 있다. 원본은9개128×128과 구판F-Party02 128×96이다. 4열156칸을153개의 완전한 그림 묶음으로 나눈다. 구판 열린 피자 상자는64×64라4칸을 한 객체로 쓴다. 여러 소품이 한 칸 안에 있으면 고정 묶음으로 유지한다. 음식·식기·포장·식후는 정적 상태이며 방향/애니메이션으로 추정하지 않는다.

`pixelArtWorldFood.ts`는 원본4열 타일셋과 식탁 합성12열 타일셋/고정 그룹/전체5×5조립 배열을 만든다. `pixelArtWorldFoodImport.ts`는 사용자 파일 둘을 SHA+decode+alphaBounds로 검사하고, 별도 ST-Icecream-I01의 완전한3×2식탁과 음식픽셀을 합성한다. 원본 식탁(0,512)96×64를3×3캔버스(0,32)에 먼저 그린 뒤 음식의 비투명 밑변 중심을(48,55)에 놓는다. 원본을 확대/축소하지 않는다. 원본파일을 앱/서버가 대신 다운로드하지 않는다.

음식 원본은upper/passable이고 받침이 필요하다. 음식만 기존상위식탁에 찍으면 식탁이 지워진다. 완전합성3×3그룹은upper이며 위 돌출행은통과, 아래식탁2행은차단이다. 바닥은하위0번으로보존하고 남쪽한칸접근을 남긴다. 매달린고기/소시지/장갑3개의 고정점조립은미검토이므로 식탁합성에서제외한다. 원본153그룹과 검토된150식탁그룹을 구분한다. 원본/합성 타일번호는서로호환되지않는다.

`panels/pixelArtWorldFoodCatalog.ts`는 기존 외부타일셋자료집에10카드를 붙인다. 음식파일과받침파일을 함께선택한다. 준비는pure이며확정등록은lineage/저장대상/abort검사후하나의snapshot+store.update로두타일셋/두에셋을넣는다. 기존다이얼로그의busy/controls를공유한다. prepare결과의kits는객체조립표본이며자동게임맵이나먹기이벤트가아니다.

브라우저 개인출력 생성: `node scripts/content/render-pixel-art-world-food.mjs /absolute/downloads http://127.0.0.1:9877`. 승인된워크트리런처를먼저실행한다. 이명령은실제prepare와카드표시만확인하고store/import/save를호출하지않는다. `output/paw-food/browser`의preparedJSON·PNG·install-plan은개인용이며Git/public에싣지않는다. 반환dataUrl은브라우저디코딩후RGBA PNG이므로파일바이트SHA가원본SHA와같다고검증하면안된다. sourceSha256/supportSha256는입력파일검사를통과한원본해시다.

20타일셋·20용도·323MD·313이미지, 원본153그룹+식탁150그룹이준비된다. 150개의5×5는완성객체의조립예제이며150개의방/장소가아니다. source준비/조립검토/공용게시/정본설치를별도단계로보고한다. root전용publisher및정본저장은이모듈의책임이아니다. 자세한전판사전과라이선스는`tiledata/pixel-art-world/FOOD.md`.

## 실제 오브젝트 등록

`preparePixelArtWorldFood`는 이제 타일셋의 `structureKits`도 채운다. 원본153개는 원본 칸 크기를 보존하며 하위는 전부-1, 상위는 전체 원본 배열이다. 이름·태그·문서에 `받침 필요` 또는 `고정점 미검토`를 표시한다. 합성150개는 실제3×3 전체 객체이고 하위는 전부-1로 기존 바닥을 보존한다. 남쪽 로컬(1,3)이 접근칸이다.5×5는 바닥과 접근을 포함한 별도 학습 예제이며 실제 스탬프 크기로 혼동하지 않는다.

각 원본 오브젝트에 source read-first+해당 recipe MD/PNG를, 합성 오브젝트에 source 및 support/composition read-first+해당 recipe MD/PNG를 연결한다. 일반 가져오기가 두 prepared.tileset을 저장할 때 이 오브젝트들도 함께 등록된다. private 반환 `kits`의5×5학습배열은 호환을 위해 유지하며 `objectKitId`로 실제3×3 structureKit를 가리킨다. 안정 ID로 설치하는 게시자는 문서 안 임시 tilesetId와 반환 kits.tilesetId를 함께 치환해야 한다.

## 공용·정본 설치 (2026-09-24)

`prepare-pixel-art-world-food-library.mjs`는 사용자 원본 SHA/실제 RGBA/완전 객체 배열을 확인하고
임시 ID를 문서 안까지 `shared_paw_food_*`로 바꾼다. `publish-pixel-art-world-food-library.mjs`
`--publish-local`은 참고 PNG를 픽셀 손실 없이 압축한 뒤 별도 `pixel-art-world-food-local`에 CAS 게시한다.
기존 native·XP 라이브러리를 대체하지 않는다. 원본/가공 픽셀은 로컬 DB에만 있고 Git에는 없다.

정본 revision39에서20타일셋과20자산 바이트가 저장·재로드됐다. 실제 AI 도구로303객체의
소유 문서와 그림을 조회하고, 새 SQLite 프로젝트 자동 생성에도20타일셋이 포함됨을 확인했다.
생성 seed가64MiB를 넘어413이 났던 생성 채널의 전송 상한 수정은 `team-project-host.md`를 따른다.
현재 설치는 객체 조립 자료다. 실제 음식이 놓인 장소의 저작/저장은 별도로 기록한다.

빌드된 편집기의 실제 file input으로 F-Party02.png와 식탁 원본을 함께 가져왔다.
별도 확인용 SQLite 프로젝트에서 신규 원본/식탁2타일셋·각9오브젝트와2자산 바이트를
새 페이지로 revision4 재로드했다. UI 성공 문구 직후의 저장 요청은 아직 진행 중일 수 있어
그 문구만 저장 완료로 쓰지 않는다. 개인 증거는 `output/paw-food-install/ui-import-proof.json`.
