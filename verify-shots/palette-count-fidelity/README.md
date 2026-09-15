# 타일 팔레트 개수 정합 — before/after 증거

실측 2026-09-14 · 표준 모드 · 1440×900 · 좌패널 300px · 합본 마을 · EasyRPG (CC0).
`before-*` 는 878d7308c(수정 전), `after-*` 는 이 브랜치다. 좌패널만 잘라 찍었다.

## 무엇이 틀렸었나

필터 바의 수는 **타일셋 인덱스 일치 수**(`filterTileIndexes`)를 셌고, 팔레트는 오토타일
대표 축약 · 변형 숨김 · 레이어 가시성까지 통과시킨 뒤에 그렸다. 두 수가 갈라졌다.

| 화면 | before 표기 | before 실제 칸 | after 표기 | after 실제 칸 |
|---|---|---|---|---|
| 바닥 · 울타리 | `11개 일치` | **1칸** (11개 중 10개가 오토타일 변형으로 축약) | `1칸 표시` | 1칸 |
| 바닥 · 지형 | `126개 일치` | **42칸** | `42칸 표시` | 42칸 |
| 덧그림 · 지형 | `126개 일치` | **0칸** | `0칸 표시` | 0칸 |
| 덧그림 · 물 | `48개 일치` | **0칸** | `0칸 표시` | 0칸 |

분류 셀렉트도 같은 수를 말한다 — before `지형` / after `지형 (42)`, 덧그림에서는 `지형 (0)`.

## 파일

- `before-01-lower-all.png` / `after-01-lower-all.png` — 필터 없음. 셀렉트 옵션 문구가 다르다.
- `before-02-lower-fence.png` / `after-02-lower-fence.png` — `11개 일치` → `1칸 표시`.
- `before-02-lower-terrain.png` / `after-02-lower-terrain.png` — `126개 일치` → `42칸 표시`.
- `before-03-upper-terrain.png` / `after-03-upper-terrain.png` — 0칸 빈 시트. before 는
  「조건에 맞는 타일이 없습니다」뿐이고, after 는 **어느 분류를 풀어야 하는지** 말한다.

## 계약

`test/sidebarFocusModes.test.ts`

- 「reports the count of cells it actually draws, on both layers」 — 두 레이어 × 다섯 분류에서
  표기 수와 실제 칸 수가 같다.
- 「explains why a bottom-layer-only category is empty on the upper layer」 — 0칸 안내가 원인을 짚는다.

