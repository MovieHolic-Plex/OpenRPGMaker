# P6 — Supabase 퇴역 (계획)

상위 설계: `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md` §8 P6 행.
앞 단계: P1 `persistence/p1-port`, P2–P4 `local-store/p2`(main 병합), P5 완료(데스크톱 앱이 실제로 뜬다).

## 끝난 상태의 정의

1. 브리지 없는 세션(웹 빌드·노드)의 기본 저장소가 **메모리 어댑터**다.
2. `src/**` 어디에도 `/rest/v1` 문자열이 없다 — 가드 테스트가 막는다.
3. `supabaseProjectSync.ts`·`supabaseRepository.ts`·`remoteOutbox.ts`·`supabaseProjectConfig.ts`·
   `spatial/persistenceHttp.ts`·연결 설정 모달 둘·`projectPickerCover.ts`·vite 의 `/supabase` 프록시가 사라진다.
   (`assets/supabaseResourceCache.ts` 는 Cache API 복사가 ref 자산 시대에 이미 no-op 이라 2026-09-16 에 먼저 퇴역했다)
   (`assets/supabaseResourceCache.ts` 는 2026-09-16 에 먼저 사라졌다)
4. `npm run gates` 가 기준선 대비 새 실패를 만들지 않는다.

### 뒤집기 실패 파일 — 확정 목록 (2026-09-16 실측)

결합된 33파일(quarantine 제외)을 뒤집힌 기본값에서 돌려 끝까지 돌린 결과:

```
Test Files  17 failed | 12 passed | 3 skipped (32)
Tests      148 failed | 214 passed | 3 skipped (365)
```

실패한 17개 중 하나는 내 가드다 — 뒤집히면 `repository.ts` 가 `supabaseRepository` 를 import 하지
않으므로 래칫의 "목록이 실제 결합과 같다" 단언이 (정상적으로) 걸려난다. 그러니까 **제품 파일은 16개**:

| 파일 | 실패 | 비고 |
|---|---|---|
| `storePersistenceProof` | 38 | 저장 영수증·증명 |
| `historyRecoveryAdmission` | 32 | **완료** — fetch 스텁 → 포트 목록 impl, 32/32 양쪽 기본값 |
| `aiConversationRemoteHistory` | 23 | 원격 대화 이력 |
| `transactionalNewRemoteProject` | 15 | 원격 발급 트랜잭션 |
| `audioDescriptionLifecycle` | 13 | **선재 빨간불**(HEAD 에서도 동일) |
| `mapConversationRemote` | 12 | 원격 대화 미러 |
| `devMediaPromotion` | 9 | 쇼케이스 미디어 승격(제품 흐름) |
| `storeSaveOrdering` | 8 | 저장 순서(비동기 전송) |
| `autosaveStatus` | 4 | 자동저장 상태 |
| `commitEditActivityAttachment` | 3 | 목표 저장소 계약 재작성 — **리더 CLI 와 얽혀 있다**(아래) |
| `loadNewRemoteProject` | 3 | 원격 발급 |
| `saveRecoveryToasts` | 2 | 복구 토스트 |
| `saveRecoveryToasts` | 2 | **완료** — 설정 목 → 테스트마다 저장소 주입 |
| `aiConversationHistoryStartup` `persistenceRecoveryUi` `runOutcomeApplyFixture` | 각 1 | `persistenceRecoveryUi` **완료**(11/11 양쪽) |
| ~~`saveActions`~~ | ~~1~~ | **완료** — 설정 목 → 테스트마다 저장소 주입 |

진행: 이관 대상 중 **4파일 완료**(`saveActions` `saveRecoveryToasts` `persistenceRecoveryUi`
`historyRecoveryAdmission`) — 모두 양쪽 기본값에서 통과. 하니스에 `setConversationListImpl` +
`calls.conversationList` 를 더해 대화 아카이브 주제도 옮길 수 있게 했다.

`historyRecoveryAdmission` 이관의 핵심: 이 파일의 성질은 **"가져오는 동안 바뀐 로컬 기록을 덮지 않는다"** 다.
예전엔 fetch 를 붙잡아 경합을 만들었는데, 이제 포트의 목록 impl 을 붙잡아 같은 경합을 만든다
(`serveList(entered, response)` — 이전 fetch 스텁과 같은 역의 도구). 단언에서 `transport` 호출 수가
`session.calls.conversationList` 로 바뀐 것 말고는 테스트 문면은 그대로다.

작은 실패들의 공통 원인: 픽스처가 **오지 않는 전송 응답을 기다려 타임아웃**한다(실측: `saveActions`
`runOutcomeApplyFixture` `persistenceRecoveryUi` 모두 `Test timed out` / `fixture completion deadline`).
뒤집힌 기본값에서는 저장소가 그 가짜 전송을 부르지 않으므로 신호가 영영 안 온다 — 고치는 곳은 픽스처의
**기다리는 지점**이다.

**주입은 테스트마다 한다**(`beforeEach`). 모듈 스코프에서 한 번 심고 `afterEach` 로 지우면,
다음 테스트가 대상 없이 돌아 **조용히 다른 경로를 탄다**(실측: `saveActions` 가 단독으로는 7ms 에
통과하는데 앞 테스트 뒤에만 타임아웃했다).

### `runOutcomeApplyFixture` 는 싸지 않다 (2026-09-16 실측)

공유 픽스처(`test/runOutcomeApplyFixture.ts`)를 브리지로 옮기려다 되돌렸다. 이유:

- `installElectronBridgeSession` 은 `repository.open()` 때문에 **async** 다. 그것을 쓰려면 `applyFixture`
  도 async 가 되고, 호출 지점이 **11파일 29곳**으로 늘어난다 — 그중 **9파일이 quarantine** 이라
  기본 스위트로 검증할 수 없다(타입만 맞춘 변경을 9파일에 뿌리게 된다).
- 얻는 것은 이관 1파일(실패 1건)이다. 비용 대비 값이 안 맞아 **되돌렸다**.

대신 하니스만 확장해 두었다: `holdNextCommit()` · `commitInputs()` · `failNextLoad()` · 기존 window 를
보존하는 병합. 기존 테스트는 그대로 통과한다. 이 픽스처는 **quarantine 스위트를 실제로 돌릴 수 있게 된
뒤**에 옮기는 것이 맞다 — 그때 async 파급을 한 번에 검증할 수 있다.

### 하니스 확장: 커밋도 붙잡는다 (2026-09-16)

`installElectronBridgeSession` 에 `holdNextCommit()` 과 `commitInputs()` 를 더했다. 저장만 붙잡을 수
있어서는 "드레인이 배경 writer 의 완료까지 기다리는가"(`runOutcomeApplyFixture`)나 커밋 계약
(`commitEditActivityAttachment`)을 관찰할 수 없다. 기존 브리지 테스트는 그대로 통과(1/1).

### 숨은 두 번째 축: 리더 CLI (발견)

`commitEditActivityAttachment` 를 열어보니 마지막 절이 **writer 와 리더의 키 일치**를 소스 스캔으로
고정한다 — `src/project/supabaseProjectSync.ts` 의 `edits: input.editActivity.entries` 와
`scripts/list-project-commits.mjs` 의 `patch.edits` 가 같은 키를 쓴다는 계약이다.

즉 이 파일은 하니스 교체가 아니라 **도구 재작성**이다: P6 이후 커밋은 포트를 타므로
`scripts/list-project-commits.mjs` (`npm run commit:log`) 도 PostgREST 대신 로컬 스토어를 읽어야 한다.
그 CLI 는 퇴역 목록에 없었으니 **계획서에 추가한다** — 안 그러면 "커밋 로그가 비어 보인다" 는 조용한
회귀가 난다.

즉 이관 대상은 **15파일**(선재 빨간불 13건을 뻨 셈) + quarantine 3파일이다.

### 전체 스위트를 뒤집어 재본 결과 (2026-09-16)

53개 결합 파일만 돌려서 본 144건과 달리, **전체 스위트**(2244파일)를 뒤집힌 기본값에서 돌려보니
(약 93% 지점에서 중단):

- **실패 143건 / 통과 11,635건 (약 1.2%)**

두 숫자가 거의 같은 것이 중요하다 — 뒤집기로 깨지는 것은 **결합된 파일들에 집중**되어 있고
나머지 스위트는 기본값과 무관하다. 즉 이관 범위는 열린 문제가 아니라 이미 세어 둔 그 집합이다.

## 실측한 크기 (2026-09-16)

폴백을 메모리 어댑터로 바꾼 상태에서 Supabase 모듈을 import 하는 테스트 53파일을 돌린 결과
**144건 실패 / 299건 통과**(중간 중단). 즉 퇴역은 테스트 이관과 **한 변경**이다 — 따로 하면
어느 쪽이든 초록이 아니다.

`src/**` 에서 Supabase 모듈을 import 하는 파일은 2026-09-16 기준 **9개**다(가드 `REMAINING_COUPLING`
이 그 목록이고, 칫이라 줄기만 한다). 시작은 25개였다.

### `remoteOutbox` 는 Supabase 모듈이 아니었다 (퇴역 목록 정정)

설계서 §8 P6 행이 퇴역 대상으로 적어  것과 달리, 실제로 읽어보니 `src/project/remoteOutbox.ts` 에는
**Supabase import 가 없다**(주석에 이름만 있다). 범용 재전송 큐고, 전송기는 포트를 부른다
(`ai-activity`·`ai-conversation` → `projectRepository().ai.*`). 로컬 저장소에서도 쓰인다.

가드의 `SUPABASE_MODULES` 에서 뻨다 — 넣어 두면 그 항목 하나가 `activityLog`·`conversationStore`·
자기 자신을 결합으로 과대집계한다(실측). 두 파일은 실제로는 타입 import 하나·문구 하나만 Supabase 를
가리키고 있었다: 타입은 포트로 옴겼고 문구는 중립으로 바꿔 둘 다 결합 0이 됐다.

**남은 판단**: 설계서는 outbox 역을 적었다. 로컬에서는 미러 재전송이  로컬 재시도라 가치가 줄지만
0은 아니다(디스크 오류·DB 김). 지금은 **살려 둔다** — 지우는 것은 별도 제품 결정이다.

핵심 도구 하나: `persistence/repository.ts` 의 `currentRemoteTarget()`. 원격 전용 표면이 **전역 설정**을
직접 읽으면 폴더 정본 세션에서도 환경의 자격증명을 집어 들어 남의 프로젝트를 향한다 — 세션의 대상을
봐야 맞다. `mapEditLocks`(잠금)와 `queryTools`(PostgREST 조회 툴)가 이걸로 옴겼다.

- 완료(런타임 decouple): `project/eventDraftVault.ts` `editor/saveActions.ts` — 설정이 아니라 **대상**에서
  projectId 를 읽는다. 예전 코드는 로컬 폴더에서도 원격 id 를 비교했고 폴더 프로젝트의 초안 금고 키가 틀렸다
- **시도→되돌림**: E2E 대상 증명을 통째로 퇴역시키려다 **e2e 스펙 8개를 깨뜨렸다** — 그 브리지는 원격 증명만이 아니라
  `currentProject()` 스냅샷 씨임으로도 쓰인다(`_blueprint-gate-live`·`editor-ceiling-local-persistence` 등).
  복원했고(잘못 들어간 메서드 위치 포함) 가드 목록에도 다시 넣었다. **정정**: 이 파일은 삭제가 아니라
  **원격 증명 메서드(`initializeRemoteFixture`·`reloadRemote`)와 자격증명 부트스트랩만** 절제하는 것이 맞다
  — 그러면 editorToolHook 의 설정 import 도 함께 사라진다.
- 완료(개념 퇴역): **E2E 원격 대상 증명** — 자격증명 다이제스트로 "이 원격 대상이 맞다" 를 증명하던 기제.
  P6 이후 정본은 로컬 폴더라 증명할 원격 대상이 없다. 지운 것: 브리지의 `initializeRemoteFixture` ·
  `reloadRemote` 와 자격증명 부트스트랩(타입·심볼·상태·증명 헬퍼), store 의 `loadNewRemoteProjectForE2E` ·
  `reloadFromRemoteForE2E`(+그 설정 사용), `test/e2e/remote-project-certificate.spec.ts`, 단위 테스트의 해당 케이스.
  **남긴 것**: 브리지의 `flush` · `currentProject()` — 아래 8개 e2e 스펙이 쓰는 스냅샷 씨임이다.
  `editorToolHook.ts` 466 → 321줄, 결합 **10 → 9**.
  전신 사고: 처음엔 파일을 통째로 지우려다 **e2e 스펙 8개를 깨뜨렸다**(그 브리지는 원격 증명만이 아니라
  `currentProject()` 씨임이기도 하다). 소비자를 잔림 없이 전수한 뒤 **절제**하는 방식으로 다시 했다.
- 완료(모듈 퇴역): `project/persistenceStatus.ts` — 영속 상태 어휘(DisabledReason·Status·ConfigField)는
  포트(`persistence/types.ts`)로 옴기고, 설정을 읽던 `dbPersistenceStatus` 함수는 퇴역할 어댑터
  (`persistence/supabaseRepository.ts`) 안으로 인라인했다. 상태 출처 타입(`"custom"|"env"|"legacy"`)도
  포트가 자기 어휘로 소유한다. 결합 **11 → 10**.
- 완료(타입을 포트로): `project/tileMetadataDb.ts` `editor/teamWorkflowUi.ts` `project/projectCommitLog.ts`
  `persistence/target.ts` `spatial/persistence.ts` `spatial/saveRouting.ts` `persistence/types.ts`
  **`project/store.ts`** — 마지막 것이 큰 진전이다: store 는 이제 **sync 모듈을 전혀 import 하지 않는다**
  (타입은 `persistence/types` 와 `spatial/saveRouting` 에서 온다). 남은 결합은 원격 **설정 개념** 하나뿐이다
  (`supabaseProjectConfigDraft`/`WithSource` 5곳: 418·526·704·775·963 — 모두 원격 발급·재로드 흐름).
  — 마지막 것이 핵심이다. 별칭만 붙이던 것을 **포트가 직접 정의**하게 바꿨고(`SaveResult` `MapPatchInput`
  `CommitInput` `CommitListItem` `CommitReviewStatus` `ProjectSnapshot` `AiActivityInput` `ConversationInput`
  `AiAnalysisRunInput`), `supabaseProjectSync.ts` 는 그걸 옛 이름으로 다시 내보낸다. 이게 되어야 모듈을 지운다.
- 남음: `ai/activityLog.ts` `ai/conversationStore.ts` `app/mode.ts` `editor/content/villageShoppingStreetProject.ts`
  `editor/editorToolHook.ts` `editor/mapEditLocks.ts`(잠금 자체는 원격 전용이라 남는다)
  `editor/panels/dbConnectionProjectPicker.ts` `editor/panels/dbConnectionSettings.ts`
  `editor/panels/projectPickerCover.ts` `editor/tools/queryTools.ts`
  `project/ontology/ontologyCapabilities.ts` `project/persistenceStatus.ts`
  `project/persistence/{repository,supabaseRepository,target,types}.ts` `project/remoteOutbox.ts`
  `project/spatial/{persistence,persistenceHttp,saveRouting}.ts` `project/store.ts`
  `project/supabaseProjectConfig.ts` `project/supabaseProjectSync.ts` `vite-env.d.ts`

훑어본 결과 남은 17개는 **타입만 옮기면 되는 것이 아니다.** 대부분 원격 **개념** 자체를 퇴역시키는 일이다:
자격증명(`supabaseProjectConfig`), E2E 대상 증명(`editorToolHook` 의 credential digest), 편집 잠금(원격 전용),
프로젝트 피커(원격 행 목록), outbox(원격 재전송), spatial HTTP 전송. 각각 "로컬 폴더 정본에서 무엇이
되는가" 를 정해야 지울 수 있다.

### mock 주제의 진짜 성질 (2026-09-16 실측)

이 13개는 `vi.mock("@/project/supabaseProjectSync")` 을 쓰는데, 그 목은 **기본 어댑터가 Supabase 일 때만**
살아 있었다 — 포트가 기본이 되면서 제품 코드는 더 이상 그 모듈을 부르지 않는다. 즉 목이 이미 죽었고,
지우는 것이 안전하며(지우고 돌려서 초록이면 죽은 것이 증명된다) 모듈 삭제를 막는 것도 그 목이다.

이번 단계에서 7파일이 모듈 참조 없이 양쪽 기본값에서 통과한다:

| 파일 | 어떻게 |
|---|---|
| `teamWorkflowUi` | sync 모듈 목을 버리고 `installMemoryProjectSession()` + `commits.list` 스파이로 같은 고정행 주입 (7/7) |
| `generateMapPaletteReload` | 전송 목을 `installElectronBridgeSession({ wire })` 로 — 저장소를 공유해 "저장 → 새 스토어로 다시 열기" 가 같은 바이트를 본다 (4/4) |
| `projectWikiHistorySources` `aiSettingsHistoryFocus` `topbarPopoverEscapeLayer` `aiConversationHistoryModal` `mapConversationStore` | 죽은 목 제거 (5파일, 양쪽 기본값 통과) |

남은 결합 테스트는 44파일이다.

추가로 이관한 3파일(양쪽 기본값 통과, 모듈 참조 0):

| 파일 | 어떻게 |
|---|---|
| `storeEventDraftPreserve` | 전송 목 → `installMemoryProjectSession()` + `save`/`saveMapPatch` 스파이 (제출된 문서를 본다) |
| `manualCommitDiff` | 전송 목 → `commits.record` 스파이 (기록된 커밋 입력을 본다) |
| `conversationStore` | 전송 목 → `ai.recordConversation` 스파이 (원격 미러가 받은 압축본을 본다) |

### 53개 결합 테스트의 세 갈래 (2026-09-16 실측 분류)

| 갈래 | 파일 수 | 폴백 전환이 깨뜨리나 | 할 일 |
|---|---|---|---|
| 스토어 주제 — localStorage 설정을 심고 기본 어댑터가 그것을 집기를 기대한다 | 17 | **깨진다** | `installMemoryProjectSession()` 으로 대상 명시 |
| mock 주제 — `vi.mock("@/project/supabaseProjectSync")` 로 모듈을 지워 버린다 | 13 | 안 깨진다(목이 이미 죽었을 수 있다) | **10파일 완료** — 남은 3파일은 quarantine |
| 어댑터 주제 — 전송 자체를 검증한다 | 23 | 안 깨진다 | 모듈과 함께 퇴역. 단 `supabaseProjectSync.test.ts` 의 legacy 복구 3건은 스토어 검증이라 살려 옮긴다 |

스토어 주제 17개: `aiConversationRemoteHistory` `aiRunRecoveryAdmission` `aiRunRecoveryRuntime`
`audioDescriptionConcurrentPersistence.quarantine` `audioDescriptionLifecycle` `autosaveStatus`
`commitEditActivityAttachment` `devMediaPromotion` `loadNewRemoteProject`
`monsterMetadataPersistence.quarantine` `persistenceRecoveryUi` `storeFlushShaEvidence`
`storePersistenceProof` `storePersistence.quarantine` `storeSaveOrdering`
`transactionalNewRemoteProject` `transactionalRemoteSourceLineage.quarantine`

### 판정 전에 HEAD 상태를 먼저 본다 (2026-09-16 실측 함정)

"뒤집힌 기본값에서 깨진다" 를 이관 필요로 읽기 전에, 그 파일이 **HEAD 에서도 이미 깨지는지** 확인해야 한다.
`audioDescriptionLifecycle` 은 뒤집힌 기본값에서 13건 실패라서 이관 대상으로 분류됐는데, 작업 트리를
잠시 치우고(`git stash push`) 같은 파일을 돌려보니 **HEAD 에서도 똑같이 13건 실패**했다 — 내 변경이
아니라 이미 빨간불이었다. 저장된 기준선(`.omo/gates-baseline.json`)은 2026-09-12 의 것라 그동안
깨진 것을 모른다.

```bash
git stash push -m probe && npx vitest run <파일> --reporter=dot | grep -E 'Test Files|Tests ' && git stash pop
```

반대로 `devMediaPromotion` 은 지금 10/10 통과하고 **뒤집힌 기본값에서만** 9건 깨진다 — 이쪽이 진짜
이관 대상이다(그리고 그 안에는 원격 행 복사 제품 흐름이 들어 있어 재작성에 가깝다).

### 퇴역한 모듈 (2026-09-16)

- `assets/supabaseResourceCache.ts` (120줄) — 업로드 자산의 base64 를 Cache API 로 복사하던 것.
  P3 에서 자산이 내용 주소 파일(ref)로 바뀌면서 이미 no-op 이었다(`uploadedAssetUrl` 이 `oprn-asset://` 를
  돌려줘 캐시가 매번 `not-base64-data-url` 로 건너뛰었다). 유일한 호출처 `store.refreshSupabaseResourceCache`
  와 호출 5곳을 지우고, 단위 테스트·e2e 스펙(`test/e2e/supabase-root-cache.spec.ts`)을 함께 퇴역시켰다.
  옛 모듈을 목킹하던 테스트 4곳의 목도 정리했다. 검증: `tsc` 통과, 관련 4파일 19건 통과.

### 하니스 window 처리를 고쳤다 (프로토타입 메서드 보존)

`aiConversationRemoteHistory` 이관 중에 픽스처 창이 `removeEventListener is not a function` 로 깨졌다.
원인은 하니스가 `window` 를 **새 객체로 펼쳐** 덮어쓴 것이었다 — 스프레드는 own enumerable 만 복사하므로
클래스 인스턴스의 프로토타입 메서드가 사라진다. 이제 **기존 window 를 살려 두고 `oprn` 만 얹었다가**
정리 때 되돌린다(원래 `oprn` 값도 포함). 저장소 디렉토리의 unload 훅도 `conversationListOptions()` 로
목록 호출에 넘어온 옵션을 볼 수 있게 했다.

### 보류: `aiConversationRemoteHistory` (23)

같은 대화 축이라 방금 도구로 옮기려 했지만, 부분 이관 상태에서 5건 실패 + 실행이 멈췄다(끝나지 않음).
반쯤 옮긴 파일을 남기는 것보다 **되돌리는 것이 낫다** — 되돌리면 정상 기본값에서 초록인 기존 상태로 돌아간다.
하니스 개선(window 프로토타입 보존·옵션 기록)은 검증해서 남겼다(3파일 76건 통과).
다음 시도 때 필요한 것: 중단 원인 진단(보유 게이트가 풀리지 않는 케이스가 있는지), 그리고 URL 기반
`respond` 를 포트 옵션 기반으로 바꿀 때 페이지·오류 케이스의 대응을 먼저 표로 정리하는 것.

### store 의 원격 발급 흐름 — 호출자별 번역표 (2026-09-16 실측)

store 의 남은 설정 2곳은 전부 **원격 발급 흐름 안**이다. "5곳 중 일부만
고친다" 는 슬라이스가 없다(읽기 두 곳을 시도해 보니 하나는 `source` 정보가 포트에 없어
부정확해지고, 하나(`reloadFromRemote` 의 projectId)는 포트 대상으로 바꿨다). 즉 여기는
**흐름 삭제**고, 호출자가 7곳이다.

대체 표면은 이미 있다: 셸이 `window.oprn.start.createProject({title})` 와 `start.openFolder()` 를 제공한다
(preload `start.createProject`/`start.openFolder`). 편집기는 폴더가 열린 뒤 `attachElectronFolderAtBoot`
로 다시 붙는다.

| 호출자 | 지금 | P6 이후 |
|---|---|---|
| `dbConnectionSettings.ts:155` | DB 설정 모달의 “새 프로젝트” | 모달 자체가 퇴역 — 셸 파일 메뉴가 대신한다(구현됨) |
| `welcomeGenreSystemPresetAction.ts` | **이관 완료** — 씨임 이름도 정직하게 (`adoptProject`) |
| `menu.ts` | **이관 완료** — 셸 `start.createProject({title, seed})` |
| `mode.ts:132` | 첫 방문 빈 프로젝트 발급 폴백 | 발급 없이 시작 화면/데모로 — 게이트가 `supabaseProjectConfig()` 를 보지 않게 |
| `welcomeGenreSystemPresetAction.ts:20` | 새 프로젝트에 장르 프리셋 | 이미 열린 폴더 프로젝트에 적용 |
| `mediaImportPersistence.ts:41` | 가져온 미디어를 새 프로젝트로 승격 | 현재 폴더 프로젝트에 쓴다 |
| `editorToolHook.ts:295,308` | E2E 대상 증명 씨임 | `remote-project-certificate.spec.ts` 와 함께 퇴역 |
| `sharedDemoIntro.ts:48` | 공용 데모 **복사** | **제품 결정 필요** — 공용 데모는 원격 행이다. 로컬에서 무엇인지(번들 샘플인지, 없어지는지) 정해야 한다 |

삭제 대상: `store.loadNewRemoteProject`, `loadNewRemoteProjectTransactionally`, `loadNewRemoteProjectForE2E`,
`reloadFromRemoteForE2E`, `getE2ESnapshot` 의 설정 읽기, 그리고 위 호출자들의 발급 경로.

완료한 것(이번 단계):

- `reloadFromRemote` 의 반환 projectId → 포트 대상 (설정 사용 5 → 4)
- `getE2ESnapshot` → 포트 대상. `ProjectE2EEffectiveTarget` 에서 `source` 를 **삭제**했다 —
  소비자를 전수 확인했더니 아무도 읽지 않았다(`editorToolHook` 은 url·projectId 만 비교,
  `remote-project-certificate.spec.ts` 는 `toMatchObject({projectId, url})`). 설정에서 출처를 읽을 수 없는데
  지어내는 것보다 필드를 없애는 게 정직하다. 설정 사용 4 → **3곳**(전부 원격 발급 흐름 안).

검증: `tsc` 통과, E2E 브리지·재로드·복구 UI·결합 가드 테스트 22건 통과.

### 첫 호출자 번역 완료 (2026-09-16)

`welcomeGenreSystemPresetAction.ts` 의 운영 의존성을 바꿨다: 예전엔 `store.loadNewRemoteProjectTransactionally`
로 원격 행을 발급했는데, 이제 **이미 열린 폴더 프로젝트에 시드를 채택하고 저장**한다
(`store.replaceProject(project, { label: "장르 시스템 프리셋" })` → `store.flush()`). 씨임 이름도
`switchToVerifiedRemoteProject` → **`adoptProject`** 로 바꿔 이름이 거짓말하지 않게 했다(주입처는 1파일).

검증: `tsc` 통과, 가드·프리셋·로컬스토어 25건 통과. 원격 발급 호출자 5 → **4**.

### 씨앗 있는 폴더 생성 기제 (2026-09-16)

남은 호출자 둘(`menu.ts` 의 새 프로젝트, `mediaImportPersistence` 의 미디어 승격)이 같은 것을 필요로 했다:
**고른 내용을 담은 새 폴더**다. 그래서 한 번 만들었다.

- 셸: `start.createProject({title, seed?})` — 폴더를 연 뒤 `store.saveSerialized(seed)` 로 시드를 심는다(로컬
  스토어가 `saveSerialized` 를 제공한다). 빈 폴더로 만들면 렌더러가 리로드 뒤에 적용할 방법이 없다.
- 브리지 타입: `OprnBridge` 에 `start` 그룹을 **추가**했다 — 지금까지 `start.*` 는 시작 화면의 인라인
  스크립트만 썼기 때문에 타입에 없었다. 편집기도 같은 경로를 쓴다.
- `menu.ts` 의 새 프로젝트: 시드를 실어 셸에 보내고, AI 프리셋 의도는 리로드 전에 남긴 뒤
  `window.location.reload()` — 부팅 attach 가 새 폴더를 연다. 데스크톱이 아니면(브리지 없음) 안내만 한다.

검증: `tsc` 통과, 레이아웃·가드·지속성 19파일 125건 통과, 앱 부팅 프로브 통과.

### 원격 발급 흐름 — 호출자 처리 현황 (2026-09-16)

| 호출자 | 상태 |
|---|---|
| `menu.ts` 새 프로젝트 | 완료 — 셸 `createProject({title, seed})` |
| `mediaImportPersistence` 미디어 승격 | 완료 — 같은 씨앗 기제 |
| `sharedDemoIntro` 편집용 사본 | 완료 — 같은 씨앗 기제 |
| `welcomeGenreSystemPresetAction` | 완료 — 열린 프로젝트에 채택 |
| `mode.ts` 첫 방문 폴백 | 완료 — 발급 제거, 게이트의 설정 읽기 제거 |
| `dbConnectionSettings` 모달 | **남음** — 모달 자체가 설정 모듈과 함께 퇴역한다 |

즉 **원격 발급 호출자는 모달 하나만 남았다**. 그 모달이 사라지면 `store.loadNewRemoteProject*` 를 삭제할 수 있고,
그때 store 의 남은 설정 사용 2곳도 함께 사라진다.

### mode.ts 도 떨어졌다 — 남은 것은 삭제 대상과 마지막 한 줄 (2026-09-16)

- `mode.ts`: 첫 방문 게이트(공용 데모를 열지)와 "저장된 온라인 선택 기억"을 제거했다. P6 이후
  열 원격 데모 행도, 발급할 행도 없다 — 부트는 항상 `store.load()` 다.
- `sharedDemoProject.ts`: 부트 게이트(`SharedDemoBootGate`·`shouldOpenSharedDemoAtBoot`)를 지웠다.
  온라인 연결이 없으면 결코 참이 될 수 없었다. 식별자와 읽기 전용 가드는 남겼다(store 가 쓴다).
- `test/sharedDemoStore.test.ts` 는 폐기했다 — 그 파일의 주제(원격 데모 행 로드·전환·게이트)가
  통째로 퇴역했다. 나중에 번들 샘플로 데모를 되살리면 그 의미론을 새로 세워야 한다.

**결합은 이제 정확히 5개**다: 지울 4개(`supabaseRepository` · `spatial/persistenceHttp` ·
`supabaseProjectConfig` · `supabaseProjectSync`)와, 그것을 아직 가리키는 **마지막 한 줄**
(`persistence/repository.ts` 의 기본 어댑터 선택 — 이걸 메모리로 바꾸고 4개를 지우면 끝난다).

### 원격 발급 API 삭제 — store 가 떨어졌다 (2026-09-16)

호출자가 모두 옴겼으므로 store 의 발급 메서드를 지웠다: `loadNewRemoteProject` ·
`loadNewRemoteProjectTransactionally` (+ 그들만 쓰던 헬퍼 `nameNewProject` · `browserHref` ·
`restoreBrowserHref` 와 import 3개). 그리고 남은 설정 타입 사용(의존성 씨임·데모 대상 구성)을 포트의
`RemoteProjectTarget` 으로 바꿨다.

결과: **store.ts 의 `supabaseProjectConfig` 참조 0** — 결합 **7 → 6개 파일**.
가드 목록은 이제 `mode.ts` · `repository.ts` · `supabaseRepository.ts` · `spatial/persistenceHttp.ts` ·
`supabaseProjectConfig.ts` · `supabaseProjectSync.ts` 다. 우리가 지울 4개(어댑터·설정·sync·HTTP)와
그것을 아직 가리키는 2개(모드의 저장 선택 기억·기본 저장소 선택기)만 남았다.

검증: `tsc` 통과, 가드·지속성·이관 테스트 21파일 155건 통과, 앱 부팅 프로브 통과.

### 설정 창·피커·커버 퇴역 (2026-09-16)

지운 것: `editor/panels/dbConnectionSettings.ts`(온라인 연결 설정 창) · `dbConnectionProjectPicker.ts`(원격 행 목록 피커) ·
`projectPickerCover.ts`(피커 표지 그림). 셋은 한 줄기였고 입구가 하나였다.

- **상태 칩은 살렸다** — `renderDbConnectionStatus` 를 `dbConnectionStatus.ts` 로 옴겼다. 칩은 여전히
  저장 상태를 보여주지만, 이제 열어 볼 온라인 설정이 없으므로 클릭은 아무 일도 하지 않는다.
- 호출 4곳을 **폴더 열기**로 바꿨다: `menu.ts` 의 `열기`(→ `start.openFolder` + 리로드),
  `mode.ts` 의 DB-필요 화면과 로드 실패 화면의 버튼(같은 경로).
- 테스트: 칩↔모달 축을 검증하던 3건은 그 축과 함께 퇴역시키고, 살아남는 2건(칩 표시·오류 문구 숨김)만
  남겼다. 삭제 모듈을 목킹하던 2파일의 목과, Escape 미처리 백로그 명단의 항목도 정리했다.

결과: **결합 9 → 7개 파일**. 남은 것은 sync·어댑터·설정 모듈과 store·mode·repository 뿐이다.

## 최종 상태 (2026-09-16, 사용자 지시로 잔여 테스트 청소·게이트 실행 중단)

- src 의 `/rest/v1` = 0, 퇴역 모듈 삭제, 부팅 폴백 = 메모리 어댑터, 가드 교체 완료.
- `tsc -p tsconfig.app.json` 통과. 핵심 로컬 스토어·지속성 테스트 20파일/110건 통과.
- 살아있는 낙진 13파일(`uxcEditorShell` 처리 완료)은 **이관 대상으로 남겨둔 채 마무리** —
  사용자가 잔여 테스트 실행을 중단 지시했다. 다음 세션에서 이관 순서(메모리 세션 주입·잠금 케이스 폐기)로 마치면 된다.
- openwiki `runtime-project-schema.md` 갱신 완료.

### 전환 완료 — 모듈 삭제·폴립·가드 (2026-09-16)

- **모듈 삭제**: `supabaseProjectSync` · `supabaseProjectConfig` · `supabaseProxyPath` · `persistence/supabaseRepository` ·
  `spatial/persistence` · `spatial/persistenceHttp`. `saveRouting` 은 라우팅 오류·권한 타입만 남기고 재작성,
  `SpatialPersistenceError` 등은 `persistenceTypes` 로 옮깠다.
- **폴립**: `repository.ts` 기본이 **메모리 어댑터**. 브리지 없는 웹 빌드는 QA 하네스.
- **맵 편집 잠금 퇴역**: 원격 행이 없어져 잠금이 성립하지 않는다 — `mapEditLocks.ts` 를 계약 유지 스텁(idle)으로
  교체(소비자 28+24곳), 테스트의 원격 잠금 케이스 폐기.
- **/supabase 프록시 제거**(vite.config) · `rest/v1` 문구까지 정리 → **src 의 `/rest/v1` = 0**.
- **가드 교체**: `supabaseCouplingBoundary.test.ts` 를 ① src 에 `/rest/v1` 없음 ② 퇴역 모듈 부활 금지
  ③ 기본 어댑터=memory 검사로.
- 동반 정리: 커밋 조회 툴을 포트 동기 `listSync` 로(브리지·메모리 구현), 온톨로지 명단 갱신.

### 남은 회귀 14파일 (폴립 낙진 — 다음 단계)

전체 스위트 2,147파일 중 41 실패(106건) — stash 프로브로 분류:
- **선재(HEAD 에서도 깨짐) 16파일**: 기준선 문제, 이 변경과 무관
- **폴립 낙진 25파일 중 11은 상기 삭제·케이스 폐기로 처리 완료**(uxc 잠금 UX 포함)
- **살아있는 낙진 14파일**: `aiApplyCommitCorrelation` `aiRunEndProof` `applyChangesetToStore`
  `assistantReviewApprovalLifecycle` `databaseOverviewTab` `functionalPersistenceProof`
  `gameTitlePersistenceProof` `mapEditHistoryProjectSwitch` `newProjectPresetHandoff`
  `storeUndoSnapshotInventory` `studioBarActions` `walkEncounterAuthoring` `walkEncounterModal`
  (+`uxcEditorShell` 처리됨). 원인 두 가지: ① VITE_SUPABASE env 스텁 → 원격 기대(메모리 세션 주입으로 이관),
  ② 잠금 스텁 영향(케이스 폐기). 이관 완료 후 `npm run gates` 로 마무리.

### 순서 정정: 플립과 삭제는 한 변경이다 (2026-09-16)

앞의 분류를 따라가면 모순이 드러난다: wire 테스트들은 **어댑터 삭제 시점에** 퇴역하는데,
플립(기본값 전환)은 삭제보다 **먼저** 온다. 그러면 플립 직후엔 그 파일들이 빨간불이다.

정리: 두 가지를 함께 낸다.

- **A. 플립 전에 이관할 것** — 성질이 로컬 경로에서도 살아야 하는 파일:
  `historyRecoveryAdmission` `aiConversationRemoteHistory` + `transactionalNewRemoteProject`·`devMediaPromotion`
  (제품 흐름 번역). 이미 끝난 것: `saveActions` `saveRecoveryToasts` `persistenceRecoveryUi`.
- **B. 어댑터와 함께 삭제할 것** — 주제가 PostgREST 전송인 파일: `storePersistenceProof` `storeSaveOrdering`
  `runOutcomeApplyFixture`(+ 그 픽스처) `mapConversationRemote` `commitEditActivityAttachment` `supabaseProjectSync.test.ts`
  등과 quarantine 묶음. 성질은 새 브리지 테스트가 지킨다(이미 세운 것 + 더 세울 것).

그래서 실행 순서는: **A 이관 → (플립 + B 삭제를 한 변경으로) → src 모듈 삭제 → `/rest/v1` 가드 → gates**.
플립만 먼저 내면 그 순간 기준선이 빨간불이 된다.

### 결정: wire 단위 테스트는 어댑터와 함께 퇴역하고, 성질은 브리지 테스트로 산다 (2026-09-16)

공유 픽스처(`runOutcomeApplyFixture.ts`)와 전송 헬퍼(`helpers/audioDescriptionPersistenceTransport.ts`)를
포트/브리지로 이관하는 대신, 그들이 잡고 있던 **성질을 브리지 테스트에 다시 세우기로** 결정했다.

근거:

- 두 헬퍼의 주제는 **PostgREST 행·바디 처리**다. 그 전송이 사라지면 그 단언들도 같이 사라지는 게 맞다.
- 이관하려면 `applyFixture` 가 async 가 되고 호출 지점 11파일 29곳이 번진다. 그중 9파일은 quarantine 이고
  **이미 빨간불**이다(기준선 27실패/19통과) — 즉 이관의 오라클이 "초록"이 아니라 "조금 더 낫거나 같음"
  이라, 29곳을 한번에 바꾸면서 무언가 어긋나도 잡아내기 어렵다.
- 대신 성질을 포트 층에서 다시 세웠다: `storeFlushSerializationBridge` 에 **"보유 커밋 기록이 in-flight 인
  동안 두 번째 flush 도 커밋을 중복으로 내지 않는다"** 를 추가했다(2/2 통과). `holdNextCommit` 이 그걸 가능하게 했다.

영향: `runOutcomeApplyFixture`(1) `storeSaveOrdering`(8) `storePersistenceProof`(38) 은 "공유 헬퍼 이관" 이
아니라 **wire 테스트 퇴역** 으로 분류된다 — 어댑터 삭제 시점에 같이 사라지고, 성질은 브리지 테스트가 지킨다.

세운 브리지 테스트:

- `storeFlushSerializationBridge` — 보유 저장이 in-flight 인 동안 뒤 flush 가 새 저장/커밋을 내지 않는다(2/2)
- `storePersistenceProofBridge` — 영수증의 sha256 이 브리지에 남은 문서의 해시와 같고, 저장 뒤 커밋 기록이
  따라오고(`projectDir`·`summary`), 다시 열어도 바이트가 그대로다(3/3)

둘 다 **양쪽 기본값에서 통과**(뒤집기 검증 5/5, 원복 확인) — Supabase 어댑터 없이도 계약이 산다.

### quarantine 스위트를 개별로 돌리는 길을 열었다 (2026-09-16)

지난 턴 공유 헬퍼 이관을 되돌린 이유는 "quarantine 소비자를 검증할 수 없다" 였다. 그 막을 풀었다:
기본 설정이 `test/**/*.quarantine.test.ts` 를 exclude 하기 때문에 CLI 로는 안 돌아간다. 그 항목만 걷어낸
설정을 만들어(`vitest.quarantine.config.ts`, 기본 설정을 import 해서 exclude 에서 그 패턴만 뺄셈) 돌린다:

```bash
npx vitest run --config /tmp/vitest.quarantine.config.ts <quarantine 파일...>
```

**중요한 발견: 그 파일들은 오늘도 빨간불이다.** 공유 픽스처를 쓰는 6파일 기준선:

| 파일 | 실패 |
|---|---|
| `aiOutcomeContinuationDelivery` | 7 |
| `aiOutcomeApplyPolicy` | 6 |
| `aiRunOutcomeLifecycle` | 6 |
| `aiRunOutcomeApply` | 5 |
| `aiStaleProposal` | 2 |
| `aiRunOutcomeOwnership` | 1 |
| 합계 | **27 실패 / 19 통과 (46)** |

즉 이 파일들에는 "초록으로 되돌리기" 라는 오라클이 없다 — 이관의 성공 기준은 **이 수치를 악화시키지 않는 것**이다.
이 기준선이 생겼으니 이제 헬퍼 이관을 검증하며 할 수 있다.

### 공유 PostgREST 테스트 헬퍼가 같은 병이다 (2026-09-16 실측)

`storeSaveOrdering`(8건)을 열어보니 `test/helpers/audioDescriptionPersistenceTransport.ts` 를 쓴다 —
`holdNextPatch()` `waitForCommits()` `accepted` 를 제공하는 PostgREST 전송 흉내다. 그 헬퍼는 다른 테스트도
공유하고(quarantine 포함), 옮기는 순간 소비자들의 **단언도 함께** wire 행 → 포트/브리지 관찰로 바뀌어야 한다.

`runOutcomeApplyFixture` 와 같은 병이다. 그래서 남은 이관은 개별 파일이 아니라 **헬퍼 층에서** 막혀 있다.
해법은 하나뿐으로 보인다: 브리지 기반 대응 헬퍼를 만들어 같은 제어면(hold·대기·관찰)을 제공하고, 소비자를
한 번에 옴기는 것 — 그때 quarantine 스위트를 실제로 돌릴 수 있어야 한다(기존에 이미 확인한 제약).

### 이관은 두 기본값에서 모두 통과하는 것으로 증명한다

폴백을 뒤집은 채로 16개를 돌리면 **83건 실패 / 53건 통과**다. 이 숫자가 이관 전후를 가르는 잣대다.
절차는 하니스 하나로 돌린다 — 어떻게 끝나든(성공·실패·SIGINT) 원복하고, 동시 실행을 거부한다:

```bash
node scripts/qa/flip-default-check.mjs <이관한 테스트 파일...>
```

마지막 줄이 `원복 확인: 기본 저장소는 Supabase 어댑터다` 여야 한다. 아니면 종료 코드 3 이고
`repository.ts` 를 손으로 봐야 한다. 왜 하니스인가: 손으로 뒤집으면 실행이 길어질 때
리포가 뒤집힌 채 남는다(실측: 두 번 남았다).

이관한 파일은 **양쪽 기본값에서 다 통과**해야 한다. 한쪽에서만 통과하면 아직 기본값에 기대고 있다.
첫 사례: `storeFlushShaEvidence` — sync 모듈 목킹을 버리고 `installMemoryProjectSession()` 으로 바꾸고,
sha256 단정도 스텅 문자열(`"sha-evidence-1"`) 대신 **실제 저장된 문서의 해시**를 보게 했다.
양쪽 기본값에서 2건 통과 확인.

### 실측 판정 (2026-09-16) — 버킷은 어림값이었다

뒤집힌 기본값에서 파일별로 재보니 스토어 주제 17개 중 **절반은 이관할 필요가 없다**:

| 파일 | 뒤집힌 기본값 | 결론 |
|---|---|---|
| `aiRunRecoveryAdmission` | 10/10 통과 | 이관 불필요 — 이미 기본값 비의존 |
| `aiRunRecoveryRuntime` | 6/6 통과 | 이관 불필요 |
| `devMediaPromotion` | 9건 실패 / 1건 통과 | 이관 필요 (제품 흐름 재작성 포함) |
| `audioDescriptionLifecycle` | 13건 실패 / 2건 통과 | 이관 필요 |

그래서 순서는 "17개를 이관한다" 가 아니라 **"파일별로 재고, 깨지는 것만 이관한다"** 다.

### 결합 경계 가드 (되돌아가지 않게)

`test/persistence/supabaseCouplingBoundary.test.ts` — `src/**` 에서 Supabase 모듈을 import 하는
파일을 **남은 목록(20개)으로 고정**한다. 목록에 없는 파일이 붙으면 실패하고, 목록에 있는 파일이
결합을 끊었는데 목록에 남아 있어도 실패한다(래칫). 변이 검증함: 새 결합을 넣으면 1건 실패,
되돌리면 3건 통과. P6 이 끝나면 이 목록이 비고, 그때 `/rest/v1` 문자열 가드가 된다.

```
src/ai/activityLog.ts              src/editor/panels/dbConnectionProjectPicker.ts
src/ai/conversationStore.ts        src/editor/panels/dbConnectionSettings.ts
src/app/mode.ts                    src/editor/panels/editor.ts
src/assets/supabaseResourceCache.ts src/editor/panels/projectPickerCover.ts
src/editor/content/villageShoppingStreetProject.ts
src/editor/editorToolHook.ts       src/editor/saveActions.ts
src/editor/mapEditLocks.ts (완료)  src/editor/teamWorkflowUi.ts
src/editor/tools/queryTools.ts     src/project/eventDraftVault.ts
src/project/ontology/ontologyCapabilities.ts
src/project/persistence/repository.ts
src/project/persistence/supabaseRepository.ts
src/project/persistence/target.ts
src/project/persistence/types.ts
src/project/projectCommitLog.ts    src/project/remoteOutbox.ts
src/project/spatial/persistence.ts src/project/spatial/saveRouting.ts
src/project/store.ts               src/project/supabaseProjectConfig.ts
src/project/supabaseProjectSync.ts src/project/tileMetadataDb.ts
src/vite-env.d.ts
```

## 실행 순서 (각 단계가 초록을 유지한다)

**1단계 — 테스트가 기본값에 기대지 않게 만든다.**

`test/support/projectSession.ts` 의 `installMemoryProjectSession()` 이 이 단계의 도구다.
기본 어댑터가 무엇이든 같은 의미가 남도록 대상을 명시한다.

53파일을 주제로 가른다.

- **어댑터 주제** — 그 파일의 검증 대상이 Supabase 전송 자체다. 모듈과 함께 사라진다.
  예: `test/supabaseProjectSync.test.ts`, `test/supabaseProjectConfig.test.ts`,
  `test/supabaseFixtureLoad.test.ts`, `test/supabaseCanonicalRoundtrip.live.test.ts`,
  `test/stardewSupabaseRoundtrip.live.test.ts`.
  **주의**: 파일 전체가 어댑터 주제인 것은 아니다. `test/supabaseProjectSync.test.ts` 안의
  legacy 복구 3건은 오래된 표본을 입력으로 쓰는 **스토어** 검증이다 — 그 케이스는 살려서
  메모리 세션으로 옮긴다.
- **스토어 주제** — 자동저장·영수증·복구·충돌 같은 스토어 동작을 Supabase 전송으로 구동한다.
  하네스를 `installMemoryProjectSession()` 으로 바꾼다. 타이밍에 기대는 케이스
  (in-flight 응답 순서, 디바운스)는 메모리 어댑터가 같은 순서를 만들지 않으므로 해당 케이스만
  무엇을 검증하는지 다시 확인한다.
- **부수 import** — 타입만 쓰는 파일은 import 경로만 바꾼다.

이 단계 끝에는 폴백이 아직 Supabase 여도 전부 초록이어야 한다.

**2단계 — 부팅 폴백을 메모리로.** `repository.ts` 한 곳. 1단계가 끝났으면 깨지는 파일이 없다.

**3단계 — 모듈·모달·프록시 삭제.** `src/**` 에서 Supabase import 가 0이 되게 한다.
`persistence/types.ts` 가 별칭으로 빌려 쓰던 타입 정의를 이 파일로 가져온다(포트가 정의를 소유한다).

**4단계 — 가드.** `src/**` 에서 `/rest/v1` 문자열을 막는 테스트를 새로 세운다.
기존 `test/noLocalProjectDb.test.ts` 옆에 둔다.

**5단계 — 문서.** `openwiki/runtime-project-schema.md`(저장소 절)·`openwiki/testing.md`(가드)·이 파일.

## 검증

```bash
npx vitest run test/localStore test/persistence test/noLocalProjectDb.test.ts --reporter=dot
npx tsc --noEmit -p tsconfig.app.json
npm run test:changed -- origin/main      # 53파일 이관 뒤
xvfb-run -a npx playwright test --config playwright.electron.config.ts
xvfb-run -a node scripts/qa/electronAppBootProbe.mjs
node scripts/oprn-store.mjs import-supabase <dir> --project <id>   # 남은 원격 작업 이관
```

## 되돌리기

단계마다 PR revert 로 돌아간다. 1단계는 순수 테스트 변경이라 제품 동작을 건드리지 않는다.

## 이번 단계에서 손대지 않는 것

- AI 완성의 Bun 워커 의존(설계서 §7.4): Electron 은 Bun 을 싣지 않는다.
- 동반 서비스(활동 로그 디스크 미러)의 Electron 구현. 현재 앱에서 `[edit-activity] 디스크 미러 실패
  (404)` 경고가 뜬다 — 퇴역 대상이 아니라 **미구현**이다.
