# 아이스크림점의 음료 식탁 · 로컬 제안 생성

`icecream-food-place.json`은 기존 10×8 장소의 벽·쇼케이스·메뉴·창·출입구를 유지하고,
작은 식탁/화분 대신 주황 음료가 있는 3칸 식탁과 마주보는 2석을 조립한다.
픽셀은 포함하지 않는다. 실제 사용자 원본과 현재 호스트/공용 읽기 사본에서만 그림을 만든다.

```sh
node scripts/content/prepare-pixel-art-world-icecream-food-place.mjs \
  output/paw-food-place/source/current-portable.json \
  output/paw-food-place/source/source-proof.json \
  output/paw-food-place/source/shared-snapshot.json \
  /absolute/user/downloads/SC-F-Juice01.png \
  output/paw-food-place/proposal
```

실행 전에 `read-pixel-art-world-host.mjs`로 정본을 읽고 현재 `/__oprn/shared-content`를
사본으로 저장한다. `export-tileset-references.mjs`로 `paw-icecream-shop`,
`shared_paw_food_juice_source`, `shared_paw_food_juice_table`의 MD/실제 그림을 읽는다.
이 스크립트는 네트워크/DB 쓰기를 하지 않으며 결과는 현재 워크트리 `output/` 아래로만 허용한다.

## 정확한 조립

아틀라스 8열과 원본 0..159는 유지한다. 음식 3×3을 160..162 / 168..170 / 176..178에
복사하고 나머지 추가 칸은 사용 금지 예약칸이다. 184칸, 256×736픽셀이다.
기본 음식 3×3 킷도 그대로 보존한다.

이번 장소는 **별도의 3×4 앙상블**을 (5,3)에 놓는다. 첫 행은 `[-1,51,-1]`, 다음 두 행은
`[168,169,170]`, `[176,177,178]`, 마지막 행은 `[-1,59,-1]`이다.
기본 음식 첫 행 3칸의 3072픽셀 알파가 전부 0임을 확인해서 가능한 구성이다.
일반 음식의 상단을 의자로 덮어도 된다는 규칙이 아니다. 북쪽 의자를 (6,2)에 두었던
첫안은 식탁과 한 칸 떨어져 보였으므로 (6,3)으로 당겼다. 음식과 식탁의 비투명 픽셀은 보존된다.

출입구 (4,7), 쇼케이스 앞 (2,5)/뒤 (2,2), 양쪽 통로 x4/x8이 연결된다.
식탁 밑동 y5와 의자 y3/y6은 불투명 원본 바닥0에 닿는다. 북쪽·남쪽 의자는 옆에서 접근한다.
먹기·착석·NPC·계산·전이 이벤트는 포함하지 않는 정적 장소다.

## 생성물과 관찰 범위

- `library.json`: 독립 장소1, 타일셋1, 사용자 로컬 자산1. 기본 음식/앙상블/전체 장소 킷3.
- `proposal.json`: 장소/타일셋/자산 및 전체 10×8 lower/upper 배열.
- `layout.md`, `assembled.png`, `comparison.png`, `ensemble-comparison.png`: 실제 타일 정상/오류.
  같은 문서와 그림은 장소·킷·타일셋의 표준 referenceDocuments에 소유된다.
- `preparation-proof.json`: 원본 SHA, 읽기 receipt, 공유 revision, 기존 의존성 JSON SHA,
  원본160칸/추가9칸 픽셀 동일, 실제 식탁/음료4992픽셀 보존, 밑동/오류 좌표,
  실제 `src/project/collision.ts`의 `canMove` BFS 경로를 기록한다.

사람은 정상/오류/앙상블 PNG를 직접 열어 조립을 별도로 검토한다. 엔진 충돌 관찰은
통행만 확인하며 이벤트 실행이나 미학을 판정하지 않는다. 전체 테스트/게이트는 실행하지 않는다.

## 부모 게시자가 할 일

기존 기본 장소를 덮어쓰지 않는 신규 `shared_paw_icecream_orange_drink_place`다.
`preparation-proof.json`의 기존 의존성 및 대상 새 ID 부재를 최신 읽기와 비교한 뒤,
동일 타일셋/자산 ID를 유지하여 중앙 공용 라이브러리에 보존형 병합한다. 이후 일반 native
publisher 재실행도 이 생성 패키지를 포함해야 한다. 이 파일은 게시자나 정본에 직접 쓰지 않는다.
정본 save/reload 및 실제 자료집 발견 여부는 부모의 별도 완료 단계다.

[Pixel Art World 규약](https://yms.main.jp/dotartworld/page1/rule.html)에 따라
원본/가공 소재는 Git·공개 패키지에 넣지 않는다. 사용자 로컬 자료이며 공개 작품에는
Pixel Art World / ドット絵世界 (yms)를 표기한다. 음식 및 받침의 제작자 페이지/SHA는 메타데이터에 기록한다.
