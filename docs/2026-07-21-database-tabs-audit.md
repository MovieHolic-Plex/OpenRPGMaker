# 데이터베이스 전 탭 감사 (2026-07-21)

> **Status:** 시점 기록. 당일 수리 완료 항목은 검증 근거와 함께 기록.

- 방법: 24개 탭 정적 배선 감사(el 버튼 핸들러 전수 스캔, 뮤테이터 추적, 런타임 소비 grep) + 전 탭 렌더 sweep e2e + 기존 qa e2e 12종 실행 + 실패 근인 추적(단계별 store 덤프·MutationObserver·activeElement 기록).
- 2026-07-07 감사(docs/2026-07-07-database-audit.md)의 12건 수리는 이번 스캔에서 재발 없음 확인.

## A. 확정 결함과 수리

| # | 심각도 | 위치 | 증상 | 수리 | 검증 |
|---|---|---|---|---|---|
| D1 | 중간 | 몬스터 탭 · 그래픽 미리보기 | 해석 불가 generated 리소스에 **클릭 핸들러 없는 "설정..." 버튼** 렌더(데드 UI) | 정적 라벨로 교체 (`databaseAdvancedRecordViews.ts` neutralResourceSlot) | `test/databaseEnemyResourceSlot.test.ts` 2/2 (RED→GREEN) |
| D2 | 중간 | 애니메이션 2 탭 | 포즈 데이터 편집·저장은 되지만 **전투 런타임이 미소비**(ActorRecord에 링크 필드도 없음) — 사용자가 효과를 기대할 수 있는 침묵 상태 | 탭에 "런타임 미연결" 고지 표시 (`db-battler-animations-runtime-note`). 완전 연결(배우 링크 + 포즈 재생)은 Phase급 신규 기능으로 B절에 분리 | `test/databaseBattlerAnimationsNotice.test.ts` (stash RED→GREEN) |
| D3 | **높음** | DB 모달 공통 (모든 탭) | blur/change 커밋 순간 `activeElement`가 일시적으로 `<body>`가 되는 틈에 store 구독이 모달 전체 재렌더 → **사용자가 이동 중인 필드가 분리되고 입력이 유실**. change 커밋형 필드(number/textarea) 2개를 연속 편집하면 재현 | ① 재렌더 판정을 rAF 프레임 시점으로 이동(포커스 정착 후 재판정) ② 마지막 상호작용 400ms 유예(grace) ③ 유예 중 보류분 플러시 타이머 (`databaseModal.ts`) | qa-crops CRUD: 수리 전 1.4분 타임아웃 실패 → 수리 후 26.7초 통과. 동일 근인이던 qa-enemies/equipment/skills 계열 실패도 배치 재실행으로 확인 |
| D4 | **높음** | 맵 편집 락 (DB/에디터 세션 환경) | 원격 저장이 꺼진 세션(`?freshProject=1` 등)도 Supabase 맵 락을 취득 → 같은 map id의 후속 세션이 "다른 브라우저 탭에서 편집 중"으로 차단됨. e2e 연속 실행이 자기 발목을 잡음 | `store.isRemotePersistenceEnabled()` 공개 + `checkoutMapForEditing` 게이트(비활성 세션은 락 미취득·idle 유지) | `test/mapEditLockScratchSession.test.ts` 2/2 + 기존 `mapEditLocks.test.ts` 2/2 유지 |
| D5 | **높음** | 적 그룹 탭 · 배틀 이벤트 패널 | "보상 흐름 템플릿"이 넣는 `m2-109-result-summary`가 M2 분류 데이터에 미등록 → `battleEventCommandRuntimeSupport`가 throw → **패널 렌더 크래시(상세 패널이 통째로 빈 화면)** + 템플릿 커맨드 미저장. 템플릿 버튼이 패널 킬러였음 | `m2RuntimeClassificationData.ts` editorOnly에 등록(런타임 소비자 0이라 사실상 편집기 전용) | 재현 스펙으로 커맨드 3개 저장 + 스트립 표시 + 에러 0 확인 → qa-troops 6/6. 단위 `test/m2ResultSummaryClassification.test.ts` |

## A2. 앱 무결함 — 구식 테스트 수정

| 위치 | 사정 | 조치 |
|---|---|---|
| qa-enemies Species CRUD / boundary | 타입 필드가 자유 입력 input이던 시절의 테스트. 현행은 타입 상성표 기반 칩 UI(최대 2개 강제, 3번째 클릭 자동 해제) | 테스트를 칩 경로로 갱신(의도한 클램프 검증은 보존) |
| db-tabs-sweep (신규) | freshProject 원격 미설정의 `ERR_CONNECTION_REFUSED` 콘솔을 결함으로 집계 | 환경 노이즈 필터 추가 |

## B. 미완성 기능 (결함이 아니라 계획된 공백)

| # | 위치 | 내용 | 권장 |
|---|---|---|---|
| B1 | 애니메이션 2 → 전투 | `BattlerAnimationRecord`(포즈별 프레임/지속시간)를 전투 배틀러 렌더가 소비하게 하려면 ① ActorRecord(또는 Class)에 battlerAnimationId 링크 추가 ② battleFieldDom의 포즈→컬럼 하드코딩(generated 시트 3열)을 레코드 프레임으로 대체 ③ 액터 탭 피커 필요 | 별도 Phase. D2의 고지로 사용자 오인은 차단됨 |

## C. 탭별 상태

| 탭 | 렌더 | 편집 배선 | 비고 |
|---|---|---|---|
| 주인공/직업/스킬/아이템/장비/몬스터/종족/적 그룹/상태 | OK | OK (qa e2e) | D3 수정으로 CRUD 안정화 |
| 작물 | OK | OK | D3의 대표 재현 탭 (qa-crops 3/3) |
| 캐릭터 | OK | OK | 프로필 관리, empty-state 정상 |
| 속성 | OK | OK | 목록/최대 개수 다이얼로그 배선 확인 |
| 전투 애니메이션 | OK | OK | 07-07 수리 유지 (재생/스테이지/셀 복사) |
| 애니메이션 2 | OK | OK | D2 고지 추가 |
| 전투 화면/전투 명령/지형/용어 | OK | OK | utilityRow 뮤테이터 배선 확인 |
| 타일셋 | OK | OK | 최대 개수 버튼은 의도적 disabled(미지원 명시) |
| 스탬프 | OK | OK | empty-state 정상, 카드 액션 배선 확인 |
| 공용 이벤트 | OK | OK | qa-commonev 커버 |
| 시스템 | OK | OK | qa-system 커버 |
| 스위치/변수 | OK | OK | 추가/이름/삭제 배선 확인 |

전 탭 sweep(`test/e2e/db-tabs-sweep.spec.ts`): 24/24 렌더, 빈 바디 0, 스텁 텍스트 0. freshProject 모드의 `ERR_CONNECTION_REFUSED` 콘솔은 원격 미설정 환경 노이즈(결함 아님).

## D. 환경/운영 메모

- e2e를 무거운 단위 테스트와 동시 실행하면 타임아웃 플레이크가 난다 — 배치는 단독 실행.
- 원격 락 TTL은 2분. 라이브(원격 저장 활성) 세션의 e2e는 락 반납/강제 탈취 경로를 써야 한다.
