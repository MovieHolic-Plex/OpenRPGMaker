# 2026-07-07 '자연산포' 시스템 설계 — 에이전트 배치의 유기성

> 사용자 브레인스토밍 합의 (2026-07-07). 배경: 에이전트가 길을 깔면 항상 십자형(축 정렬 직선 2개) —
> `paint_road`가 waypoint를 직선 세그먼트(`lineCells`)로만 연결하고, 모델이 보통 가로/세로 1선씩만 주기 때문.
> 일반적으로 '랜덤성'이 요구되며(사용자가 "정갈하게"를 요구하면 예외), 이를 결정론적 '자연산포'로 해결한다.

## 합의된 축 (사용자 확정)
1. **범위**: 전방위 — 길(구불거림) + 식생/소품(군락 산포) + 건물(위치 지터)
2. **제어**: 공통 `naturalness` 파라미터(0~1, 기본 0.5) + 프로젝트 기본값은 세계관 guideline 개체
3. **접근법**: 결정론 알고리즘을 툴에 내장 (시드 RNG, 재현 가능). LLM waypoint 재량(기각) / 사후 naturalize 툴(v2)

## 코어 모듈 — `src/editor/tools/naturalScatter.ts`
전부 시드 RNG(`src/util/rng.ts`) 주입. 같은 시드 = 같은 결과 (Phase 6A 결정론 계약 준수).

- `wobblePath(points, naturalness, rng)` — waypoint 사이를 편향 랜덤워크로: 목표 방향 가중 + 수직 지터
  (진폭 ∝ naturalness) + 스무딩 패스. naturalness ≥ 0.6에서 폭 1~2칸 변화.
  **n=0이면 기존 `lineCells` 결과와 완전 동일** (회귀 0 보장). 산출 경로는 4-연결 보장.
- `poissonScatter(bounds, count, minGap, rng)` — 블루노이즈 산포 (균일하되 뭉침 없음).
- `clusterScatter(bounds, anchors, count, falloff, rng)` — 군락: 앵커(큰 나무 등) 주변 밀집 + 빈터 자연 발생.
- `jitterPlacement(pos, maxOffset, rng, isValid)` — 건물 위치 지터. 지터 후 `isValid`(충돌/도로 접근) 재검사,
  불가 시 원위치 폴백.

## 툴 통합 (Wave 2)
- `paint_road`: `naturalness?` 파라미터 → wobblePath 경유. 오토타일 셰이핑(`shapeRoadAround`/`shapeSandAround`) 재사용.
  교차는 십자 강제 대신 경유점 공유로 자연 접합.
- `scatter_object`: naturalness에 따라 uniform/poisson/cluster 모드 자동 선택.
  **클러스터 hard 규칙 자동 동반 배치와 합성** (군락 안에서도 침엽수 상·하단 원자 배치 유지).
- `build_house`/`stamp_structure`: jitterPlacement 적용.
- 마을 생성 스킬 폼에 "자연스러움" 슬라이더.
- 툴 설명에 LLM 지침: "정갈/반듯" → 0~0.2, 기본 0.5, "야생/자연/구불구불" → 0.8+.

## 기본값 해석 순서
호출 파라미터 > 세계관 guideline 개체(예: "계획도시 — naturalness 0.1", 세계관 W3 배선에 편승) > 0.5.

## 테스트
- 시드 고정 스냅샷 (같은 입력·시드 → 동일 출력)
- n=0 == lineCells 동일성 (전 스타일)
- wobblePath 4-연결성 + 경계 클램프
- poisson minGap 보장 / cluster 앵커 근접 분포
- jitter 제약 재검사 폴백
- e2e: AI에 "구불구불한 길" → paint_road naturalness 반영
- 최종 실측: 도그푸딩 재실행("마을 만들기")으로 십자 탈피 + 클러스터 규칙 사용을 함께 평가

## 구현 웨이브
- **N1**: 코어 모듈 + 테스트 (신규 파일만 — clusterfix 스트림과 무충돌)
- **N2**: 툴 통합 + 스킬 폼 + LLM 지침 (clusterfix 머지 후 — placementTools/mapTools 충돌 회피)

## 진행 기록
- 2026-07-07: 설계 합의·문서화. N1 codex 착수 (worktree rpg-zzu-wt-natural).
