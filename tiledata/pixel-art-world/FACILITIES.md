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
4. `src/assets/pixelArtWorldFacilitiesCatalog.json`은 3팩·43개 부품의 정확한 `tiles`와
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

## 반복과 레이어 주의

- 벽의 가운데 반복은 17 / 병원·편의점 하단25 / 식당 하단33이다. 오른쪽 끝18을 반복하면
  매 칸 세로 줄이 생긴다. 최초 렌더에서 발견해 가운데 칸으로 바꿨다.
- 가구는 사각형 전체를 원본 순서로 함께 놓고 뒤집지 않는다. 진찰 장비를 싱크라고
  오인하지 않는다. 조립 사전의 `clinic-sink` ID는 안정된 식별자이며 표시명은 검사 장비다.
- 식당은 불투명 카운터 몸체96..98을 lower, 앞면120..122를 upper로 나눈다.
  반투명 상판112..114를 lower로 직접 쓰면 빈 픽셀이 바닥 대신 검게 보이므로 금지한다.
  계산대는 몸체 위 upper, 앞면 밑은 원본 바닥0을 보존한다.
- 편의점 계산대는 lower88..90/96..98 위 upper POS/온장 진열을 놓는 명시적 합성이다.
  일반 진열장·의자·가림막은 floor를 유지하는 upper다.
- 식당 오른쪽 화분은 x=12이다. x=11로 옮기면 오른쪽 바닥 3칸이 분리된다.

## 구조 확인과 한계

생성기는 범위/배열 길이/부품 중첩/홈 레이어 충돌을 거부한다. 첫 남쪽 입구에서 4방향
탐색으로 모든 `approachCells`와 **모든 통과 바닥 칸**의 연결을 확인한다.
최종 도달 바닥: 의원55, 편의점56, 식당59칸. 최소 통로 폭은 1칸이다.
모든 실제 합성 PNG를 직접 열어 전체 부품/벽 반복/카운터 받침/출입구를 확인했다.
이는 이벤트 실행, 런타임 게임 플레이, SQLite 저장 완료를 주장하지 않는다.
테스트/gates/vitest/typecheck는 실행하지 않았다.

가구 정상/오류 그림은 기존 사용자 PNG 가져오기 흐름이 만든다. 원본을 가져오기 전에
공용에 예시 PNG를 싣지 않는다. 시트의 다른 장비/계단/외부 파일은 미검토 상태다.
