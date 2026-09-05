# 현재 실행 기록

조사일: 2026-09-05. 기준 코드: `32ef1bcd66476d09486a8a09893da02184d2ebd5`.
보고서 작성 과정에서 제품 코드는 수정하지 않았다.

## 생활 관련 집중 테스트

감독자가 `/home/main/z-project/rpg-zzu-life-audit-p1`에서 `npm test -- <아래 파일 전체>`를
한 번 실행했다. 도구 세션은 `bash_3`, 모니터는 `mon_007M00TSH9TEDNZV`다.

결과 원문 요약:

```text
Test Files  4 failed | 53 passed (57)
Tests       4 failed | 406 passed (410)
exit code: 1
```

실패 목록:

| 테스트 파일 | 실패한 계약 | 관측 |
|---|---|---|
| `test/p0ProjectSchema.test.ts` | keeps old projects free of newly invented optional fields and byte-stable | `serialize(deserialize(before))`와 `before`의 문자열 동일성 실패 |
| `test/p1FoundationSchema.test.ts` | keeps legacy projects byte-stable without optional P1 authored fields | 같은 구형 프로젝트 문자열 동일성 실패 |
| `test/p2ProjectSchema.test.ts` | keeps legacy projects byte-stable without P2 fields | 같은 구형 프로젝트 문자열 동일성 실패 |
| `test/p2SpatialEditorAuthoring.test.ts` | exposes a discoverable life tab with a product asset and honest aggregate count | `tab.dataset.count`: expected `"0"`, received `undefined` |

이 결과는 전체 생활 플레이가 깨졌다는 뜻이 아니다. 첫 세 테스트는 서로 다른 생활 패키지
스위트에서 공통 구형 프로젝트 정규화 계약을 검사한다. 네 번째 테스트의 개수 속성 실패도
건물 배치 트랜잭션 실패와 같지 않다. 제품 결함인지 낡은 테스트 계약인지 추가 소스 대조가 필요하다.
406개 통과 역시 필드 플레이와 원격 저장까지 완주했다는 증거는 아니다.

실행 파일:

```text
test/characterDepthYSort.test.ts
test/characterFootprint.test.ts
test/characterHop.test.ts
test/characterHopChainedScale.test.ts
test/characterIdAutocomplete.test.ts
test/characterIdIndex.test.ts
test/characterIdPickerDialog.test.ts
test/characterIdRelationshipGate.test.ts
test/characterListThumbnail.test.ts
test/characterProfiles.test.ts
test/databaseLifeCraftingView.test.ts
test/editorNpcSchedule.test.ts
test/friendshipGiftsShop.test.ts
test/lifeAuthoringReferences.test.ts
test/npcSchedule.test.ts
test/npcScheduleReferenceIntegrity.test.ts
test/p0Bundles.test.ts
test/p0CommerceFinalSafety.test.ts
test/p0DayTransitionSceneFailure.test.ts
test/p0EconomySafetyFollowup.test.ts
test/p0Energy.test.ts
test/p0LifeLedgerUi.test.ts
test/p0LifeSkillProgress.test.ts
test/p0Makers.test.ts
test/p0ProjectSchema.test.ts
test/p0RuntimeIntegration.test.ts
test/p0SafetyHardening.test.ts
test/p0SessionPersistence.test.ts
test/p0Shipping.test.ts
test/p0ToolCapability.test.ts
test/p0TransitionControlFlow.test.ts
test/p1DayTransitionIntegration.test.ts
test/p1FarmAnimals.test.ts
test/p1FoundationSchema.test.ts
test/p1HostileAudit.test.ts
test/p1LifeEditorAuthoring.test.ts
test/p1ReferenceIntegrity.test.ts
test/p1RuntimeHud.test.ts
test/p1RuntimeUi.test.ts
test/p1SessionPersistence.test.ts
test/p1WeatherCalendar.test.ts
test/p1WeatherDayTransition.test.ts
test/p2DayTransition.test.ts
test/p2EditorAuthoring.test.ts
test/p2HostileAudit.test.ts
test/p2LifeLedgerUi.test.ts
test/p2LifeRuntime.test.ts
test/p2ProjectSchema.test.ts
test/p2ReferenceLifecycle.test.ts
test/p2SessionPersistence.test.ts
test/p2SpatialEditorAuthoring.test.ts
test/p2SpatialPersistence.test.ts
test/p2SpatialPlayIntegration.test.ts
test/p2SpatialReferenceIntegrity.test.ts
test/p2SpatialRuntimeUi.test.ts
test/p2SpatialSchema.test.ts
test/p2SpatialTransactions.test.ts
```

## 환경과 브라우저

- 워크트리 기본 배정 9841 및 수동 선택 19441은 이미 다른 프로세스가 점유했다.
  다른 서버를 재사용하거나 종료하지 않았다.
- 빈 포트를 확인한 뒤 `DEV_SERVER_NO_TLS=1 npm run dev:worktree -- --port 40059`로 기동했다.
  현재 서버: `http://127.0.0.1:40059/`, 감독자 모니터 `bash_7`.
- `Bun.WebView`는 `only available on the main thread`로 실패했다.
  저장소에 이미 설치된 Playwright Chromium으로 전환했다.
- `?blankProject=1`은 기존 코드의 일시적 빈 프로젝트 검사용 경로다.
  이 경로의 화면은 빈 상태 편집 UI 증거일 뿐, 원격 프로젝트 콘텐츠나 저장 성공 증거가 아니다.
- Markdown LSP가 구성되어 있지 않아 `SCOPE.md` 언어 서버 진단은 실행할 수 없었다.
  문서 검증에는 인용·링크·범위 검사와 독립 검토를 사용한다.

## 원격 작업 상태

지정 프록시를 사용한 `gh repo view --json nameWithOwner,defaultBranchRef`는
`proxyconnect tcp ... connect: connection refused`로 실패했다.
PR 생성·검토·병합을 실행한 것으로 보고하지 않는다.
