# 집/마을 구조 계획(플랜) 아키텍처 + aiChatPanel 재분할 — 설계 (사용자 지시)

- 작성일: 2026-07-08
- 근거: 사용자 지시 5개 항목 (2026-07-08)
- 대상: `rpg-zzu-wt-6a` (feat/phase-6a)

## 개념 재정의 (사용자 지시 2·3)

> '벽'과 '지붕'은 서로 다른 **자재 세트**다. '집'은 자재가 아니라 **구조 계획(플랜)** 이라는 다른 개념이다.

- **자재 세트(MaterialSet)**: 벽세트(회벽/통나무…), 지붕세트(오렌지/파랑…), 문세트, 창세트 — 각각 독립 vocab.
- **집(HousePlan)**: footprint(바닥 평면)에서 ① **벽 공간을 먼저 확보**하고 ② **나머지를 지붕 공간으로 확보**한 뒤, 각 공간을 자재 세트로 채우는 **계획**.
- **프리셋**: 1층집/2층집/ㄱ자집 등 — 층수(벽 행수)·평면 형태·기본 자재 세트를 미리 정의. 팔레트 🏠집 버튼은 프리셋 선택 UI를 가진다.

## 시공 알고리즘 (사용자 지시 3 — 열 단위 일반화)

```
wallRows(stories): 1층=2행, 2층=4행
footprint: 선택 rect 또는 ㄱ자(두 rect 합집합) 셀 마스크

for each column x in footprint:
  yMax(x) = 그 열의 footprint 최남단
  벽 공간  = [yMax-wallRows+1 .. yMax]        ← 남쪽 노출면마다 벽 (먼저 확보)
  지붕 공간 = [yTop(x) .. yMax-wallRows]       ← 나머지를 지붕으로 채움
  지붕 열 내부: 최상단=용마루(374류), 중간=몸통(375류), 벽 바로 위=처마(405류)
```

- **ㄱ자 검증 케이스(사용자 예시)**: 왼쪽 위 rect + 오른쪽 아래 rect 합집합 → 남쪽 노출면이 두 군데 생기고, 열별 규칙에 따라 벽이 두 단으로 깔린 뒤 지붕이 ㄱ자로 채워진다.
- 문: 가장 긴 남쪽 벽면 중앙 1개. 창: 벽 폭·높이 여유 시 문 좌우 대칭.
- 기존 `stampHouse`(rect 전용, roofRowsFor)는 이 일반화로 대체. build_wall(9-slice)은 열 세그먼트별 rect로 호출하거나 동등한 직접 페인트.

### HousePreset

```ts
interface HousePreset {
  id: string;            // "cottage-1f" | "house-2f" | "l-house-1f" ...
  name: string;          // "1층집", "2층집", "ㄱ자집"
  stories: 1 | 2;        // 벽 행수 결정(2/4)
  shape: "rect" | "l";   // footprint 형태. l이면 선택 rect를 두 rect 합집합으로 분해
  wallSet / roofSet / doorSet / windowSet: vocabId (기본값 = 현 프리셋)
}
```

- 팔레트 UI: 🏠집 버튼 옆 프리셋 선택(팝오버 내 세그먼트/드롭다운, testid `build-house-preset`). 마지막 선택 기억(localStorage).

## 마을(Village) (사용자 지시 4)

새 프리미티브 🏘️마을: 선택 영역에
1. **집 공간 먼저 확보** — 프리셋 집 footprint들을 겹치지 않게 시드 기반 배치(간격≥1, 시작위치·기존 구조 회피),
2. **그 다음 집들 사이에 길** — 각 집 문 앞 지점들을 lay_path로 연결(문→가장 가까운 길/이웃 문).

순서 고정: 집 → 길. 실패한 집(공간 부족)은 건너뛰고 결과 요약에 보고.

## 지형 템플릿 참조 여부 (사용자 질문 5 — 방침)

- **팔레트 프리미티브(결정적) = 템플릿 비참조.** 템플릿은 고정 크기 완성형 스탬프라 파라메트릭 플랜과 층위가 다름. 프리미티브는 자재 세트 테이블만 참조.
- **자재 세트 카탈로그의 소스로는 참조 가능** — 템플릿의 "어울리는 조합" 지식을 세트 정의에 반영(후속).
- **AI-fill(에이전트) 경로 = 기존대로 템플릿 참조 유지.**

## 재분할 (사용자 지시 1)

- `aiChatPanel.ts` 2404줄 → 신규 성장분 추출: **aiProposalModal.ts**(몰입 모달+pill), **aiCommandBar.ts**(커맨드 바+⌃메뉴+rising overlay 조립), 필요 시 aiConversationLog.ts(버블/추론/미니스트림). 동작 불변·re-export·테스트 수 불변 원칙(기존 분할과 동일).
- `tabs-b-assistant-panel.css` 2451줄 → 관심사별 분리: `assistant-command-bar.css`, `assistant-proposal-modal.css`, `assistant-rising-overlay.css`, `assistant-skills.css` 등 + index 등록. 셀렉터 변경 금지(순수 이동).

## 검증

- tsc 0 / vitest 전체(2293+) 불변 + 신규(ㄱ자 열별 벽·지붕 배치, 프리셋 선택, 마을 순서) 테스트.
- E2E: ㄱ자 프리셋 시공 스크린샷(벽 두 단 + ㄱ자 지붕), 마을 프리미티브(집 N채 + 사이 길).
- 모델 정책: minimax/minimax-m3 유지.
