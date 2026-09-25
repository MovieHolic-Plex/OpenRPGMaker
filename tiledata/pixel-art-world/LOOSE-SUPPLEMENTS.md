# 개별 소품 조립 보충 — 독립 5팩

기존 카탈로그28의106원본/539객체와 prepared 파일을 변경하지 않는 독립 atlas. **5조립 사례, 9주요 정적 상태, 기존 검증 벤치1, 작은 장소5**를 지원한다. 타일셋5·오브젝트/보조가구10·장소kit5=총15 structureKits다. 새장 닫힘처럼 기존 완성본과 같은 시각 결과도 있으므로9상태를모두새그림이라고세지않는다.

## 출처와 선행 읽기

[제작자 개별 소품](https://yms.main.jp/dotartworld/page3/chips01.html), [규약](https://yms.main.jp/dotartworld/page1/rule.html). 히나 분리 가공부품·단계별 완성, 금줄의 상위 레이어, 촛불 위행좌/아래행우 설명을 읽었다. 페이지가직접연결한 [가드레일 사용 사진](https://yms.main.jp/dotartworld/sozai/tileset/smp_modern01/WS000021.JPG)을브라우저로열었다. 이사진은보도·도로·가드레일의문맥이며새합성5장이공식샘플이라는뜻은아니다.

정본 SQLite 프로젝트 `6ae74f7a-23a2-449b-8171-5afb5dff532b`, revision44, document SHA `f8de00af8ce7af350b7db15d110305edb1b6adec4291e62a7b14523508b04110`을읽기전용으로읽었다. `export-tileset-references.mjs`로현재 paw-icecream-shop/paw-park 문서를추출하고read-first·spatial-layout·icecream-table-wide·park-bench-front의MD및실제원본/조립그림을읽었다. 새loose원본은그정본105타일셋에아직없었으므로이번조립근거는현재바닥/벤치문서와제작자원본을명시적으로결합한다. ai_conversations는그정본에0행이었다.

[받침 아이스크림점](https://yms.main.jp/dotartworld/page2/tile-fastfood01.html)의바닥/벽, [공원](https://yms.main.jp/dotartworld/page2/tile-park01.html)의흙/검증벤치만재사용한다. 모든원본SHA/치수/URL은 `loose-supplements.json`에있다. 픽셀은사용자원본파일에서만생성하며원본/가공소재를Git/public에넣지않는다. 공개게임크레딧은Pixel Art World / ドット絵世界.

## 전체 조립 계약

`parts`의 sourceRect/target/anchor는픽셀, outputRect/supportCells/blockingCells는32px칸. sourceParts를순서대로알파합성하고 `mode: replace`는해당목적사각을지운뒤새상태를복사한다. base/front는중간합성순서이며맵레이어를추가하지않는다. 그결과를독립8열atlas에배치한다. 원본번호·기존539객체번호를바꾸거나재사용하지않는다.

객체kit는하위-1/상위전체배열. 빈상위영역에전체로배치하여기존바닥을보존한다. 여러파트를기존상위칸에따로겹치면먼저놓은파트가삭제되므로금지. L자화단의오른쪽아래2×2공백은상위-1이며벤치등별도물체를넣을수있다. 단독화단과벤치는각각온전한배열이다.

각kit는 source/support read-first,개별MD,모든원본그림,실제소스파트정상/반례그림,전체배열정상/조각삭제오류그림을소유한다. 장소kit는방·정적출입틈·진입점·접근좌표·하위/상위전체배열·정상/진입차단오류그림을소유한다. 모든접근점은생성단계의4방향통행그래프에서진입점과연결됐다. 런타임이벤트검증은아니며 events=[]이다.

## 5사례와 작은 장소

|팩|정적 상태와 정확한 조립|장소|
|---|---|---|
|hina|받침(0,128,96,128)→인형배열(96,128,96,128),같은원점|7×8진열실. 양옆바닥1칸,남쪽관람1칸|
|shrine|닫힘본체160×192. 열린판은y96하부160×96교체. 금줄+방울(192,32,96,64)을(32,80)에전면합성. 닫힘/열림2상태|7×8돌포장참배마당.남쪽접근|
|cages|빈본체(0,128,96,128),닫힘전면(128,32,32,96)/열림전면(224,32,64,96)을(32,32)에합성. 황동/청색×닫힘/열림4상태|9×8점검실.사이1칸과남쪽1칸통로|
|altar|BlackMagic01(0,0,96,96),SC04좌frame0(0,0,32,32)→(0,0),우frame0(0,32,32,32)→(64,0)|5×7제단실.남쪽접근1칸|
|planter|원본3×3외곽/중앙+SE오목모서리(128,224,32,32)로고정5×5 L자,기존벤치64×64별도|7×7쉼터. L안쪽2×2벤치,남쪽접근. 흙만있어심기전표본|

신사금줄y80은그림비교로처마전면연결을선택한고정앵커다. 공식좌표값이라고주장하지않는다. y64반례는윗지붕면에줄이고정된다. 열린신사/새장은그림상상태이며보수적전체물체차단을유지한다. 출입/문개폐이벤트가없다. 촛불은frame0만정적지원하며실제재생순서/fps를추정하지않는다.

히나의첫5×8배치는실제밑동바닥은정상이었으나양측벽이전폭진열과이어져벽위처럼보이는시각결함이었다.7×8로고쳐양옆바닥1칸을드러냈다.실제최하단y183과각96픽셀열의하위tile0/통행바닥을확인했다. wall-mounted로재분류하지않았다.

## 보류 해소 제안 — 기존 봉인은 유지

source-only11영역중고정조립이해결된것은신사열린하부와금줄+방울2영역이다. plain금줄/붉은천/32×96별도판은미해결. 다른source-only나기존메타데이터의수치를이번팩이직접수정하지않는다.

잔여19파일전체를완료처리하지않는다. hina01의하단인형배열만해결,상단개별/머리없는부품은보류. Eu-Cage01/02의닫힘/열림전면만해결,중간철창·내부내용가림·문이벤트는보류. SC-Candle04는좌/우frame0만해결,frame1~3/타이밍은보류. guardrail은SE오목모서리의한고정L조립만해결,다른3오목판과가변형상문법은보류. 이경계를공용publisher의범위문서에덧붙이고원래106prepared를덮지않는다.

## 생성과 인계

`prepare-pixel-art-world-loose-supplements.mjs`는메타데이터/전체배열/좌표/접근연결을생성한다. `render-pixel-art-world-loose-supplements.mjs <downloads>`는실제브라우저pureprepare를통해5개privateprepared/그림/install-plan을생성한다. 일반사용자모달은전용appender에서팩별필요PNG를함께선택하며정확SHA/디코딩치수를검사한다. 가져오기는asset+tileset+15kits를기존undo/store저장경로에추가한다.

검증자료는개인 `output/paw-loose-supplements/`: read-current-*의선행문서,canonical-read.json,rope-anchor-comparison.png,hina-support-proof.json/png,all-sourceparts.png,browser/*-prepared.json/assembled-scene.png,seal해시. 공용게시/정본등록은감독자가수행한다. 준비파일의UUID를안정ID로바꾸면kit/타일셋MD의실제tilesetId도함께치환한다.

제단후광 대조: parts왼쪽96×96과atlas제단의RGBA는완전히같다. 같은파트를실제바닥위에브라우저canvas로합성하면장소crop과채널차이0이다. 검정/회색투명미리보기와밝은바닥에서반투명노란후광이다르게보이는것이며프레임혼용이아니다. SC04좌/우모두x0의frame0을사용한다.
