# 오류 교훈 — 실제로 변조한 오류 그림과 검출 기록

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

아래 네 가지는 정본 마을 20호를 **실제로 변조**해 만든 그림이고, 검사 코드가 같은 좌표를 잡는다(`tiledata/joseon-village/qa-tamper-checks.json`).
정상 맵은 `door-unreachable`·`object-tile-in-lower-layer`·`bridge-blocked` 0 건, 마스크 불일치는 알려진 칸(「땅 오토타일」)뿐이다.

| 코드 | 맵 좌표 | 변조 | 검출 좌표(앞 3개) |
|---|---|---|---|
| `door-unreachable` | (3,22) | 문 앞 칸에 rocks(막힘 1칸)를 윗층에 놓음 | [['door-unreachable', 3, 22]] |
| `object-tile-in-lower-layer` | (59,34) | zelkova_a 수관 8칸을 lowerTiles 에 칠함 | [['object-tile-in-lower-layer', 59, 34], ['object-tile-in-lower-layer', 60, 34], ['object-tile-in-lower-layer', 61, 34]] |
| `autotile-mask-mismatch` | (40,5) | jb_water47_autotile 칸 마스크 55 → 205 | [['jb_water47_autotile', 40, 5]] |
| `bridge-blocked` | (42,28) | 다리 갑판 한 칸에 rocks | [['bridge-blocked', 42, 28]] |

## 1. 문 앞 막힘 — `door-unreachable`
문 앞 한 칸(조각 바로 아래)에 소품·나무를 두면 디딤돌에 못 올라선다. 문 앞 3칸은 비운다. 검사: 시작 칸에서 모든 문 앞 칸까지 4방향 도달.
## 2. 수관을 아래층에 — `object-tile-in-lower-layer`
조각의 투명 부분이 있는 칸은 **윗층**에만 칠한다(키트로 찍으면 저절로 맞는다). 아래층에 칠하면 밑에 땅이 없어 검게 빈다. 검사: 아래층 칸이 지형 묶음 번호인가.
## 3. 반대 방향 둑 — `autotile-mask-mismatch`
오토타일 칸을 손으로 바꾸면 이웃과 둑 방향이 어긋난다. 칠하는 도구로 다시 칠하면 맞는다. 검사: 이웃 8칸으로 정한 변형과 실제 칸 비교(구운 알려진 불일치는 제외).
## 4. 다리 갑판 막힘 — `bridge-blocked`
갑판(`F`) 칸에 막힘 조각을 얹으면 강을 건널 수 없다. 갑판 칸은 모두 걸을 수 있어야 한다.

## 검사가 주장하는 것·주장하지 않는 것 (item 7)
이 네 검사는 **구조와 통행**만이다. 이벤트 실행, 미적 품질(자연스러움·밀도), 저가 모델 성공률은 구조 검사 통과로 대신 주장하지 않는다.
저장 전에 위 검사가 실패하면 부분 배치를 남기지 않는다.

## 기존 문서·칸 메타의 레이어 정정 (item 8)
조선 칩셋은 신규다 — 정정할 이전 문서·before/after 가 없다. 이 칩셋의 칸 메타(`tileMeta`)는 처음부터 투명 여부·홈 레이어(`defaultLayer`)·통행(`passage`)·렌더 우선순위(`priority`)를 따로 적는다:
조각 칸은 `defaultLayer: upper`, 통행 X=`solid`/C=`star`/F=`passable`, priority X·C=`upper`/F=`lower`. 땅 칸은 `lower`.
