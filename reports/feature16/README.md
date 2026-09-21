# 요청한 엔진·에디터 16개 기능 구현 및 검증

2026-09-21 · 비교 기준 커밋 `74b49013047d28bce74873fbf3db46293ceb7ee8`.
5개 기능 담당 에이전트의 격리 작업을 통합하고 감독 세션에서 테스트와 실제 브라우저 검증을 수행했다. 제품 코드·위키·회귀 테스트를 변경했으며, 운영 LegacyDb 프로젝트 콘텐츠는 수정하지 않았다.

## 기능과 화면 증거

| 기능 | 사용 경로와 구현 범위 | 스크린샷 |
|---|---|---|
| 맵별 기후·실내 차단 | 맵 설정 → 기후. 전역 상속/고정/실내. 실내 진입은 전역 날씨를 지우지 않는다. | [고정 기후](evidence/world-editor/climate-fixed.png), [실내](evidence/world-editor/climate-indoor.png) |
| 데미지 공식 스튜디오 | 자료집 → 스킬 → 전투 규칙·피해 수식. 제한된 산술 파서, 예제 능력치 미리보기, 잘못된 수식 저장 차단. | [수식](evidence/combat/feature16-combat-skills.png), [오류](evidence/combat/feature16-combat-invalid-formula.png) |
| 적 AI 행동 조건 | 자료집 → 적/적 그룹. 턴·HP·MP·상태·생존 동료·스위치 조건을 실제 선택기에 적용. | [조건](evidence/combat/feature16-combat-enemy-condition.png) |
| 다단히트·연격 | 스킬별 타격 배율 배열. 비용 한 번, 타격별 상태 재계산, 사망 시 후속 피해 중지. | [스킬 규칙](evidence/combat/feature16-combat-skills.png) |
| 스킬별 크리·명중·쿨다운 | 스킬 성공·명중률, 급소 확률/배율, 재사용 대기 턴. strict/gauge 실행 및 추가 행동 재검사. | [스킬 규칙](evidence/combat/feature16-combat-skills.png) |
| 전투 로그·리포트 | 플레이어 ESC → 기록 → 전투 기록. 실제 전투 결과/보상/행동 기록, 세이브 호환. 최대 20전투×120행. | [실제 전투 기록](evidence/battle-runtime/10-report-detail.png) |
| 적 의도·약점 저작면 | 자료집 → 적 그룹. 가정 턴/HP/MP/대상/열을 바꿔 조건 통과 후보와 피해 예측·약점을 확인하고 편집. | [의도](evidence/battle-editor/intent.png), [약점](evidence/battle-editor/weakness.png) |
| 전위·후위 편성 | ESC → 파티 → 편성. 참전/대기 및 전열/후열. 후열 물리 공격·피격 배율 각각 0.75, 마법·회복 유지. | [후열](evidence/battle-runtime/04-back-row.png) |
| 복수·조건부 드롭 | 자료집 → 적 → 보상. 개별 확률·수량·조건. 전투 종료 상태 정리 전에 조건 평가, 기존 단일 드롭 호환. | [드롭](evidence/combat/feature16-combat-drops.png) |
| 액션 스킬 프로필 | 자료집 → 스킬 → 액션 스킬. 투사체/근접/돌진/함정, 사거리·대기·수명·독/둔화·탄약. | [함정 저작](evidence/world-editor/action-trap.png), [돌진 실행](evidence/world-runtime/dash/cast.png) |
| 프롬프트 라이브러리 | AI 패널 → AI 저작 도구. 프로젝트별 템플릿 CRUD·태그 검색·슬롯 채우기·입력창 삽입. | [라이브러리](evidence/ai/01-library.png), [미리보기](evidence/ai/01b-template-preview.png) |
| 대사 인벤토리·문체 검수 | AI 저작 도구 → 대사 목록·문체 검토. 화자/맵 필터, 구조 검사, 저장된 문체 규칙 기반 LLM 검토, 원문 이동. | [검수](evidence/ai/02b-review-finding.png), [원문](evidence/ai/04-source-page.png) |
| 프롬프트 인스펙터 | AI 저작 도구 → 프롬프트 검사기. 실제 전송 직전 요청·도구 노출, 민감값 마스킹, 관측 기록 비우기. | [실제 요청](evidence/ai/03-inspector.png) |
| 플레이어 설정 | ESC → 시스템 → 설정. BGM/SE·대사 속도·동작 줄이기, 장치별 저장. | [설정](evidence/player/07-settings-changed.png) |
| 인벤토리 정렬·필터 | ESC → 아이템. 유형 필터·정렬, 원래 아이템 식별자/사용 동작 유지. | [정렬](evidence/player/03-sorted-inventory.png), [필터](evidence/player/04-equipment-filter.png) |
| 상점 미구현 표면 정리 | 가짜 강화/교환/장바구니/비교 수치·재고 압박 제거. 실제 구매/판매·장비 비교와 단방향 상점 유지. | [상점](evidence/player/09-shop.png) |

## 테스트 결과

- **신규 기능 19파일 185개 통과.** 마지막 결합 실행에서 184/185였던 Gen1 MP 테스트는 적의 Struggle 반동과 Gen1 HP 상한을 분리한 fixture로 수정했다. 해당 파일 10/10 재실행 통과. 제품 기대값을 낮춘 것이 아니라 MP 피해가 HP를 변경하지 않는 계약을 검증한다.
- **기존 회귀 18파일 192개 중 191개 통과.** 남은 `battleGaugePrediction`의 `announces a faster enemy even when both gauges are zero`는 기준 커밋 전체 실행에서도 동일 이름으로 실패했다.
- 앱 타입 검사 `npm run typecheck:app` 통과.
- Playwright 실제 편집기 AI/전투 저작 테스트 각 1개 통과. 기후·4종 액션 저작 캡처와 JSON 왕복 확인, 의도·약점·좁은 화면 캡처 스크립트 통과.
- 전용 `player.html` 플레이어: 설정/인벤토리/상점 **9단계 통과**, 편성/실제 전투/리포트 **11단계 통과**, 근접/돌진/함정/투사체 및 실내외 날씨 키보드 검증 통과. 각 시나리오 manifest/summary 및 world `proof.json`을 증거 폴더에 보존했다.
- 최신 전투 플레이어 첫 재실행은 타이틀 화면 대기 시간 초과였고, 다른 캡처 종료 후 단독 재실행은 전체 통과했다. 안정적인 전체 환경 통과로 과장하지 않는다.
- CSS 게이트와 surface 게이트는 **기존 실패가 남아 있다**. CSS 주요 수치는 원본과 동일(hex 1549, undefinedVars 42); 원본 fixture를 복원한 live CSS 검사도 동일한 `.ee-icon` margin-top 실패다. surface 실패 파일들은 기준 전체 테스트에서도 실패했다. 모든 assertion의 동일성까지 입증한 것은 아니다.
- 기준 전체 테스트 raw 결과: 22,599개 중 21,968 통과·614 실패·17 대기. wrapper는 flaky 재시도 도중 작업 트리 삭제를 발견해 중단했으므로 전체 gates 완료/통과를 주장하지 않는다. 이후 현재 작업 폴더에서 통합 검증과 화면 수집을 다시 수행했다.

기계 판독 요약은 [validation.json](validation.json), 최종 게이트 진단은 [gate-results](gate-results/)에 있다. 전체 raw 18MB 테스트 보고서는 중복 첨부하지 않았다.

## 재현

```bash
npm test -- test/feature16*.test.ts test/feature16-*.test.ts --maxWorkers=4 --minWorkers=1
npm run typecheck:app
DEV_SERVER_PORT=9853 E2E_RETRIES=0 npx playwright test test/e2e/feature16-combat.spec.ts --workers=1
node scripts/capture-feature16-ai.mjs http://127.0.0.1:9853
FEATURE16_EDITOR_URL=http://127.0.0.1:9853 node scripts/capture-feature16-world-editor.mjs
AUDIT_BASE=http://127.0.0.1:9853/ node scripts/capture-feature16-battle-ui.mjs
node scripts/capture-feature16-world-player.mjs
npm run qa:runtime -- --scenario feature16-player
npm run qa:runtime -- --scenario feature16-battle-ui
```

편집기 캡처는 해당 워크트리의 `npm run dev:worktree` 서버가 필요하다. 실제 콘텐츠가 아닌 테스트 fixture만 사용한다. 테스트/브라우저 작업은 과부하를 피하도록 순서대로 실행한다.

## 범위와 한계

- 대사 목록은 저장된 맵 이벤트의 모든 페이지와 중첩 분기를 수집한다. 공통 이벤트와 저장 전 임시 편집 초안은 제외하며 화면에도 표시한다.
- AI 검토 브라우저 검증은 실제 공용 요청 경로를 통과하되 제공자 응답은 mock이다. 라이브 모델의 문체 판정 품질은 검증하지 않았다. Pi 제공자 훅은 worker 재빌드가 필요하다.
- 검사기 토큰 수는 문자 수/3의 추정치다. 상위 단계 컨텍스트 압축량과 제공자 내부 처리는 이 관측 경계에서 알 수 없다.
- 적 의도는 화면에 명시한 가정에서의 후보·예측이다. 실제 전투 AI의 다음 행동 확정을 의미하지 않는다. 전투 리포트의 턴은 런타임 완료 턴/게이지 주기여서 첫 주기 내 승리는 0으로 기록될 수 있다.
- 시각 검토는 대표 편집기/플레이어 캡처에서 수행했다. 모든 화면 크기·모든 스킨·모든 게임 장르를 완전 검증했다는 의미는 아니다.
