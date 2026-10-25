# 버들항 중세 건물(덩어리 모형) · 검수 통과 건물 7채

**사용자 위임 허용**(2026-10-25)만 들어 있다: 그림 해시마다 3/4 관문(object-gate kind structure) 영수증 + 독립 검수자 둘(argon · klb-sonnet-5-5)의 원문 PASS 가 있고, 설치가 object-gate 출구를 다시 확인했다(결정 로그 harness-data/building-kit/massing/decisions.json, 프로필 building-kit-massing). 반려·미통과 그림은 없다. 시트 beodeul_massing(tex_beodeul_massing, 16px, 16열, 320칸), 모든 프로젝트의 beodeul_city 에는 `ensureBeodeulMassing`(translateTiles)로 이식되어 있다. 칸 번호를 다른 시트와 섞지 않는다 — 현재 프로젝트의 키트 id(bd-house-mk-*)로 놓는다.

## 조립 순서(건물 한 채)
1. 본체 width×height 와 **문 아래 한 칸**(접근칸)을 평지에 예약한다. 잘라서 줄이거나 반복하지 않는 고정 키트.
2. 같은 원점에 **2층 bd-mk-shadow-<id>(바닥 그림자) → 3층 bd-house-mk-<id>(본체) → 4층 bd-mk-foundation-<id>(기초)** 를 놓는다. 그림자·기초는 w+1,h+1 칸이고 통행에 영향이 없다. 그림자·기초를 빼면 건물이 땅에서 떠 보인다.
3. 아래 1층에는 밝은 잔디(beodeul_city 737)와 흙/포석 길을 놓는다. 문 앞에서 길 칸까지 canMove 경로를 확보한다.
4. 건물끼리는 사각형이 겹치면 안 된다(본체 칸 3층 충돌 금지). 같은 키트를 연속으로 놓지 말고 폭·지붕 색·층수를 섞는다.

## 통행과 문
- **벽 칸은 막힘, 지붕 처마 칸은 걸을 수 있음.** 벽 칸은 그린 이가 칸마다 적은 walk 격자(X 막힘·D 문·* 지나감)를 그대로 쓴다. 문 칸과 땅에 닿는 칸은 막힘이다(성문·시장홀 통로 칸만 예외).
- 키트 한 채마다 입구 한 곳(parts.entrance, 문 그림 칸). **문 그림·문 앞 접근칸·출입구·전이 이벤트는 다르다** — 이 키트는 그림과 통행만 준다. 문 안으로 들어가는 전이 이벤트는 맵에 따로 만든다.
- 문 앞 칸(문 y + h)은 키트 밖이므로 길로 비워 둔다. 소품·나무로 막지 않는다.

## 정확한 예제와 검사
72×13 거리 예제(건물 7채): bd-mk-street-plan(배치), bd-mk-street-layer-1~4(전체 층 배열), 실제 mapTileDraw 출력은 그림 bd-mk-street. 검사: 모든 문 앞이 열려 있고 문 칸이 막혀 있으며 벽 칸 전부가 막히고 처마 칸 전부가 걸을 수 있음을 canMove/isPassable 로 확인했다. 자동 검사는 구조와 통행만 본다. 이벤트 실행·미적 품질·저가 모델 성공률은 이것으로 주장하지 않는다.

## 정상/오류
blocked-rv-entrance: bd-house-mk-chapel 문 앞 (10,10)에 실제 anvil 소품을 3층에 넣으면 정상 canMove=true, 변조 false. 그림 bd-mk-error 의 왼쪽이 정상, 오른쪽이 변조다.

## 목록
- bd-house-mk-chapel · 예배당 · 11×9 · 문 (3,7) · 목골·돌 · 원본 chapel
- bd-house-mk-cottage · 단층 오두막 · 5×5 · 문 (1,4) · 목골·돌 · 원본 cottage
- bd-house-mk-dovecote · 비둘기탑 · 3×5 · 문 (1,4) · 목골·돌 · 원본 dovecote
- bd-house-mk-inn · 여관 · 10×7 · 문 (2,5) · 목골·돌 · 원본 inn
- bd-house-mk-l-farmhouse · ㄱ자 농가 · 9×6 · 문 (7,4) · 목골·돌 · 원본 l-farmhouse
- bd-house-mk-longhouse · 롱하우스 · 11×5 · 문 (1,3) · 목골·돌 · 원본 longhouse
- bd-house-mk-smithy · 대장간 · 7×5 · 문 (1,3) · 목골·돌 · 원본 smithy

원본 그림은 tiledata/beodeul-massing/sources/, 설치는 `npm run harness -- beodeul-building-review install --profile building-kit-massing`, 이 자료는 scripts/content/rebuild-building-bundle.sh building-kit-massing.
