# 버들항 · 사람이 허용한 건물 42채

beodeul-building-review 검수 화면에서 **사람이 현재 그림 해시에 허용**한 건물만 들어 있다(결정 로그 harness-data/beodeul-building-review/decisions.json). 거절·미선택 그림은 없다. 시트 beodeul_reviewed(tex_beodeul_reviewed, 16px, 16열, 768칸), 모든 프로젝트의 beodeul_city 에는 `ensureBeodeulReviewed`(translateTiles)로 이식되어 있다. 칸 번호를 다른 시트와 섞지 않는다 — 현재 프로젝트의 키트 id(bd-house-rv-*)로 놓는다.

## 조립 순서(건물 한 채)
1. 본체 width×height 와 **문 아래 한 칸**(접근칸)을 평지에 예약한다. 잘라서 줄이거나 반복하지 않는 고정 키트.
2. 같은 원점에 **2층 bd-rv-shadow-<id>(바닥 그림자) → 3층 bd-house-rv-<id>(본체) → 4층 bd-rv-foundation-<id>(기초)** 를 놓는다. 그림자·기초는 w+1,h+1 칸이고 통행에 영향이 없다. 그림자·기초를 빼면 건물이 땅에서 떠 보인다.
3. 아래 1층에는 밝은 잔디(beodeul_city 737)와 흙/포석 길을 놓는다. 문 앞에서 길 칸까지 canMove 경로를 확보한다.
4. 건물끼리는 사각형이 겹치면 안 된다(본체 칸 3층 충돌 금지). 같은 키트를 연속으로 놓지 말고 폭·지붕 색·층수를 섞는다.

## 통행과 문
- **벽 칸은 막힘, 지붕 처마 칸은 걸을 수 있음.** 벽 칸은 칸별 밝은 회벽/돌 색 비율로 가려 열별 지면에서 위로 이어 붙였고, 문 칸과 맨 아래 줄은 항상 막힘이다. 통나무집은 지붕 아래 벽 띠 전체가 막힘이다.
- 키트 한 채마다 입구 한 곳(parts.entrance, 문 그림 칸). **문 그림·문 앞 접근칸·출입구·전이 이벤트는 다르다** — 이 키트는 그림과 통행만 준다. 문 안으로 들어가는 전이 이벤트는 맵에 따로 만든다.
- 문 앞 칸(문 y + h)은 키트 밖이므로 길로 비워 둔다. 소품·나무로 막지 않는다.

## 정확한 예제와 검사
64×22 거리 예제(건물 8채): bd-rv-street-plan(배치), bd-rv-street-layer-1~4(전체 층 배열), 실제 mapTileDraw 출력은 그림 bd-rv-street. 검사: 모든 문 앞이 열려 있고 문 칸이 막혀 있으며 벽 칸 전부가 막히고 처마 칸 전부가 걸을 수 있음을 canMove/isPassable 로 확인했다. 자동 검사는 구조와 통행만 본다. 이벤트 실행·미적 품질·저가 모델 성공률은 이것으로 주장하지 않는다.

## 정상/오류
blocked-rv-entrance: bd-house-rv-r2-04 문 앞 (11,18)에 실제 anvil 소품을 3층에 넣으면 정상 canMove=true, 변조 false. 그림 bd-rv-error 의 왼쪽이 정상, 오른쪽이 변조다.

## 목록
- bd-house-rv-r10-01 · 통나무 오두막 · 5×6 · 문 (2,4) · 통나무 · 원본 r10-building-01
- bd-house-rv-r10-03 · 초록 문 통나무집 · 5×6 · 문 (2,4) · 통나무 · 원본 r10-building-03
- bd-house-rv-r10-04 · 통나무 이층집 · 5×8 · 문 (2,6) · 통나무 · 원본 r10-building-04
- bd-house-rv-r10-05 · 꽃창이 있는 통나무 이층집 · 5×8 · 문 (2,6) · 통나무 · 원본 r10-building-05
- bd-house-rv-r10-06 · 덧문 통나무 이층집 · 5×8 · 문 (2,6) · 통나무 · 원본 r10-building-06
- bd-house-rv-r2-01 · 낮고 긴 민가 · 7×6 · 문 (2,4) · 목골·돌 · 원본 r2-building-01
- bd-house-rv-r2-02 · 좁은 박공 이층집 · 4×8 · 문 (2,6) · 목골·돌 · 원본 r2-building-02
- bd-house-rv-r2-03 · 회벽 ㄱ자집 · 8×8 · 문 (1,6) · 목골·돌 · 원본 r2-building-03
- bd-house-rv-r2-04 · 넓은 회벽 여관 · 8×8 · 문 (4,6) · 목골·돌 · 원본 r2-building-04
- bd-house-rv-r2-05 · 기와지붕 돌벽 대장간 · 6×6 · 문 (3,4) · 목골·돌 · 원본 r2-building-05
- bd-house-rv-r2-06 · 회벽 화물 창고 · 7×6 · 문 (2,4) · 목골·돌 · 원본 r2-building-06
- bd-house-rv-r2-07 · 넓은 박공 상점 · 5×6 · 문 (2,4) · 목골·돌 · 원본 r2-building-07
- bd-house-rv-r2-09 · 푸른 기와 교회 · 12×13 · 문 (7,11) · 목골·돌 · 원본 r2-building-09
- bd-house-rv-r2-10 · 작은 돌벽 박공집 · 4×6 · 문 (2,4) · 목골·돌 · 원본 r2-building-10
- bd-house-rv-r3-01 · T자 붉은 기와 여관 · 9×8 · 문 (4,6) · 목골·돌 · 원본 r3-building-01
- bd-house-rv-r3-02 · 쌍박공 황동 기와 여관 · 9×9 · 문 (2,7) · 목골·돌 · 원본 r3-building-02
- bd-house-rv-r3-03 · 기와 차양과 마루가 있는 빵집 · 6×7 · 문 (1,4) · 목골·돌 · 원본 r3-building-03
- bd-house-rv-r3-04 · 올리브 지붕 약방과 옆채 · 7×6 · 문 (2,4) · 목골·돌 · 원본 r3-building-04
- bd-house-rv-r3-05 · 푸른 첨탑 마법사 거처 · 7×11 · 문 (5,9) · 목골·돌 · 원본 r3-building-05
- bd-house-rv-r3-06 · 넓은 박공과 옆채의 회관 · 11×8 · 문 (2,6) · 목골·돌 · 원본 r3-building-06
- bd-house-rv-r3-07 · 안마당과 두 날개의 큰 여관 · 12×9 · 문 (2,7) · 목골·돌 · 원본 r3-building-07
- bd-house-rv-r3-08 · 청회색 주거동이 붙은 무기점 · 10×8 · 문 (2,6) · 목골·돌 · 원본 r3-building-08
- bd-house-rv-r3-09 · 둥근 너와 지붕의 제분소 · 4×9 · 문 (1,6) · 목골·돌 · 원본 r3-building-09
- bd-house-rv-r3-10 · 황동 지붕과 돌출 박공의 서점 · 10×8 · 문 (1,6) · 목골·돌 · 원본 r3-building-10
- bd-house-rv-r6-01 · 꺾인 너와 지붕 양조장 · 6×6 · 문 (3,4) · 목골·돌 · 원본 r6-building-01
- bd-house-rv-r6-02 · 청회색 맨사드 지붕 열쇠점 · 8×10 · 문 (4,8) · 목골·돌 · 원본 r6-building-02
- bd-house-rv-r6-03 · 낮은 황동 기와 돌벽 목욕탕 · 8×6 · 문 (4,4) · 목골·돌 · 원본 r6-building-03
- bd-house-rv-r6-04 · 둥근 통지붕 찻집 · 7×6 · 문 (2,4) · 목골·돌 · 원본 r6-building-04
- bd-house-rv-r6-05 · 종 모양 지붕 파수탑 · 4×11 · 문 (1,8) · 목골·돌 · 원본 r6-building-05
- bd-house-rv-r6-06 · 긴 너와 지붕 숲지기 숙소 · 10×6 · 문 (2,4) · 목골·돌 · 원본 r6-building-06
- bd-house-rv-r6-07 · 높은 박공과 낮은 옆채 직조 공방 · 8×8 · 문 (2,6) · 목골·돌 · 원본 r6-building-07
- bd-house-rv-r6-08 · 높낮이가 다른 청회색 서기관 집 · 9×9 · 문 (3,7) · 목골·돌 · 원본 r6-building-08
- bd-house-rv-r6-09 · 별빛 구근 지붕 관측소 · 5×8 · 문 (2,6) · 목골·돌 · 원본 r6-building-09
- bd-house-rv-r6-10 · 둥근 종탑과 긴 예배당 · 10×9 · 문 (5,7) · 목골·돌 · 원본 r6-building-10
- bd-house-rv-r7-01 · 둥근 창의 작은 돌집 · 4×7 · 문 (2,5) · 목골·돌 · 원본 r7-building-01
- bd-house-rv-r7-02 · 길게 누운 지붕의 농가 · 8×7 · 문 (3,5) · 목골·돌 · 원본 r7-building-02
- bd-house-rv-r7-08 · 두 박공 사이의 넓은 집 · 10×10 · 문 (5,8) · 목골·돌 · 원본 r7-building-08
- bd-house-rv-r7-09 · 긴 맨사드 지붕의 연립집 · 11×10 · 문 (5,8) · 목골·돌 · 원본 r7-building-09
- bd-house-rv-r8-01 · 박공 앞면 이층집 · 4×9 · 문 (2,7) · 목골·돌 · 원본 r8-building-01
- bd-house-rv-r8-02 · 금빛 기와 사각 지붕집 · 8×9 · 문 (4,7) · 목골·돌 · 원본 r8-building-02
- bd-house-rv-r8-06 · 돌벽 박공 이층집 · 4×9 · 문 (2,7) · 목골·돌 · 원본 r8-building-06
- bd-house-rv-r8-07 · 돌벽 올리브 지붕집 · 6×9 · 문 (2,7) · 목골·돌 · 원본 r8-building-07

원본 그림은 tiledata/beodeul-reviewed/sources/, 설치는 `npm run harness -- beodeul-building-review install`, 이 자료는 scripts/content/rebuild-beodeul-reviewed.sh.
