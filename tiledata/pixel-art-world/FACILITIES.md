# Pixel Art World 시설 실내 — 메타데이터 전용

2026-09-24. 제작자 **Pixel Art World / ドット絵世界 (yms)**.
[이용 조건](https://yms.main.jp/dotartworld/page1/rule.html)을 유지한다.
PNG·공식 예시 그림은 이 저장소/앱에 재배포하지 않는다. 사용자 다운로드 원본에
좌표·전체 배열을 적용하는 공용 자료다. 부모 도시 작업이 카탈로그 연결과 SQLite 저장을 맡는다.

| 팩 / 원본 | 공식 설명 | 크기 | SHA-256 |
|---|---|---|---|
| `paw-clinic-interior` / `ST-Hospital-I01.png` | [병원](https://yms.main.jp/dotartworld/page2/tile-hospital01.html) | 256×1856 | `1174a42296b5738d0f2cd7a844d743509194da89c62d3d634150a527c8275d89` |
| `paw-conveni-interior` / `ST-Convi-I01.png` | [편의점](https://yms.main.jp/dotartworld/page2/tile-conveni01.html) | 256×1280 | `6725e647d6007ab7bca5f4a9f2f784c7433bac672fdd01e649bf6cb544773d77` |
| `paw-fastfood-interior` / `ST-Fdshop-I01.png` | [패스트푸드](https://yms.main.jp/dotartworld/page2/tile-fastfood01.html) | 256×1440 | `70672a4e173856dce360986370b55970933bdb4ce449198e98af5a09b3efd342` |

공식 예시를 먼저 확인했다. 병원 `smp_modern01/smp-hospital06.JPG`(대기실),
`smp-hospital09.JPG`(진찰실), 편의점 `smp_shop01/smp-shop01.jpg`부터 `04.jpg`,
식당 `smp_shop01/smp-shop19.JPG`와 `20.JPG`. 모두 제작자 사이트의
`https://yms.main.jp/dotartworld/sozai/tileset/` 아래에 있다.
연구 원본과 번호 격자는 `/tmp/paw-facilities/`, 실제 합성 그림은 해당 워크트리의
`output/paw-facilities/`(gitignored)에만 둔다. 모델 생성 그림을 쓰지 않았다.

## 사용 순서와 전체 배열

1. `facilities.json`의 `downloadUrl`에서 사용자가 받은 원본 바이트 해시와 치수를 확인한다.
2. 원본은 **32px, 8열, 0기준**이다. 번호 = `y*8+x`; 픽셀 사각형 = `sourceRect` 각 값 ×32.
3. `node scripts/content/prepare-pixel-art-world-facilities.mjs`로 생성한다. 네트워크/그림에 접근하지 않는다.
4. `src/assets/pixelArtWorldFacilitiesCatalog.json`은 3팩·45개 부품의 정확한 `tiles`와
   각 방의 `lowerTiles`/`upperTiles` **168칸 전체 배열**을 담는다.
5. lower 전체를 먼저 쓰고 upper 전체를 쓴다. -1도 그대로 보존한다. `placements`는
   원점/부품 ID 기록이다. 부품을 다시 중첩해서 쓰는 추가 지시가 아니다.
6. `passableTiles`만 바닥 통과, 가구 사각 점유 영역과 벽은 차단이다.
   `lowerTileIds`는 홈 레이어 정의이며 upper ★ 우선순위와 별개다.

| 장면 ID | 범위 | 구조 / 입구 |
|---|---|---|
| `clinic-waiting-exam` | 14×12 | 서쪽 접수대·TV·6석 대기, 동쪽 침상·모니터·이동 가림막·검사 장비. 남쪽 `(6,11)`, `(7,11)` |
| `conveni-compact-shop` | 14×12 | 북쪽 냉장고/식품, 서쪽 계산대, 중앙 병음료/생필품, 동쪽 잡지, 남쪽 작은 진열대. 같은 남쪽 입구 |
| `fastfood-compact-diner` | 14×12 | 북쪽 메뉴·조리대·계산, 동쪽 분리수거, 남쪽 2인 식탁 2개. 같은 남쪽 입구 |

북벽은 y=1,2이고 내부 바닥은 x=1..12, y=3..10이다. x=0/13과 y=0,
남쪽 입구 이외 y=11은 원본의 빈 타일이다. 외부 조립자가 이 테두리를 XP 천장으로
덮을 수 있다. **입구 두 칸은 덮지 않는다.** 출입 그림/전이 이벤트/NPC는 별도 작업이다.
다른 PNG, 별도 병원 문·커튼 캐릭터 파일, RTP 타일을 이 배열에 섞지 않았다.

## 2026-09-24 적대적 시각 검토 후 교정

최초 결과의 통행 성공을 시각적 완성으로 잘못 판단했다. 현재 정본에서 export한
`before.json`의 자료와 원본 픽셀을 다시 대조했고 아래 결함을 수정했다.

| 이전 결함 | 교정한 정확한 원본 / 배치 |
|---|---|
| 의자141/149와142/150을 한 방향 2석으로 잘못 묶음 | `clinic-waiting-bench`는 141/149 **정면 단품** 1×2. 6개를 같은 방향으로 놓음 |
| 약품363과371이라는 독립 물체를 수직 연결 | 약품장은376/384/392의 유리 상단·약품·서랍 완전체 1×3. (8,1), 바닥 접지 y=3 |
| 모호한 검사대250/251/258/259를 방 중간에 배치 | 잘못 정의한 `clinic-sink` 레시피/배치를 삭제 |
| 진료 기구가 대기실 가운데에 흩어짐 | 진료는 북동쪽. 측면176/184/192/200 가림막 전체 (7,2), 전면193/194/201/202 가림막 (7,6), (9,6). 남쪽 x=11,12를 진입 통로로 비움 |
| 병원 화분 윗잎47 누락 | 47/55/63 전체 1×3. (12,8)에 둬 하단은 바닥 y=10 |
| 편의점 counter를 lower로 덮고 기물을 올림 | 완전한88/89/90/96/97/98 upper 응대대 + 독립 ATM156/164/172. POS/온장 소품은 이 장면에 쓰지 않음 |
| 식당 세로 카운터96..98을 가로 반복해 세로 이음새가 생김 | 112/113/114/120/121/122 **3×2 전체** upper 주문대 두 개. 원점 (1,5), (5,5) |
| 식당 수거함174/175와182..191의 다른 변형을 연결 | 182/183/190/191 **2×2**만 씀. 작은 별도 변형을 붙이지 않음 |
| 싱크볼342/343 밑에 전혀 다른 난간350/351을 붙임 | 싱크볼342는 countertop 단품으로만 사전에 유지하고 장면에서는 제외. 316..318/324..326/332..334 조리대 완전체 사용 |

모든 가구는 upper이며 원본 바닥을 보존한다. 프로젝트 전용 lower backing 예외를 만들지 않는다.
식당 POS는 카운터와 같은 upper 슬롯을 차지하므로 이 장면에서는 생략한다.
원본 상단 용기153/154와 별도 단말169/170도 셀프 계산대라고 이어붙이지 않는다.

## 받침 분류와 반복 규칙

- 모든 레시피에 `placementKind: standing | wall-mounted | countertop`과
  사각형 안 상대좌표 `supportCells`를 제공한다.
- standing의 supportCells는 실제 발판 행이다. 그 밑 lower는 `passableTiles`의 바닥이어야 한다.
  장식이 위쪽 벽에 일부 걸쳐도 된다. **몸체 전체가 벽 위인 배치는 금지**한다.
- wall-mounted는 창·시계·포스터·메뉴판이다. 밑의 벽17/25 또는17/33을 확인한다.
- countertop POS·온장고·싱크볼은 별도 받침이 필요한 물체다. 이 세 장면에는 배치하지 않으며
  바닥에 그대로 놓거나 가구 전체로 오인하지 않는다.
- 벽 가운데 반복은17 / 병원·편의점 하단25 / 식당 하단33. 끝18을 반복하지 않는다.
- 외곽 빈 칩은 의원·편의점0, 식당8이다. 식당0은 실제 바닥이므로 0=빈 칩이라고 일반화하지 않는다.
  외부 조립자가 XP 천장을 덮을 때 빈 칩과 실제 바닥을 구분해야 한다.

## 구조 확인과 한계

생성기는 범위/배열 길이/부품 중첩/홈 레이어 충돌/발판 종류 불일치를 거부한다. 첫 남쪽 입구에서 4방향
탐색으로 모든 `approachCells`와 **모든 통과 바닥 칸**의 연결을 확인한다.
최종 도달 바닥: 의원56, 편의점53, 식당62칸. 최소 통로 폭은 1칸이다.
`node scripts/content/render-pixel-art-world-facilities.mjs /path/to/user/pngs`는
사용자 원본 해시/치수와 각 standing 물체의 **실제 alpha 최하단 픽셀**이 바닥에 있는지 확인하고
PNG 및 `grounding-proof.json`을 gitignored `output/paw-facilities/`에 만든다.
검토한 바닥 가구 수는 의원16, 편의점13, 식당12다. 모든 최종 PNG를 직접 열었다.
이는 이벤트 실행, 런타임 게임 플레이, SQLite 저장 완료를 주장하지 않는다.
테스트/gates/vitest/typecheck는 실행하지 않았다.

가구 정상/오류 그림은 기존 사용자 PNG 가져오기 흐름이 만든다. 원본을 가져오기 전에
공용에 예시 PNG를 싣지 않는다. 시트의 다른 장비/계단/외부 파일은 미검토 상태다.

재검토: 측면 가림막은176/184/192/200 전체4칸, 진료의자는(11,6)로 옮겨 안쪽통로를 확보한다. 식당 주문대는(1,5)/(4,5)/(7,5)로 이어 조리/객석을 나누고 동쪽 통로만 연다.
